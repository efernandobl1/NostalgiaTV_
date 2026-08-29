import { Component, OnInit, signal, computed, ViewChild, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Validators } from '@angular/forms';
import { ChannelErasService } from './channel-eras.service';
import { ChannelsService } from '../channels/channels.service';
import { SeriesService } from '../series/series.service';
import { ChannelEraResponse, ChannelEraRequest } from '../../../shared/models/channel-era.model';
import { ChannelResponse } from '../../../shared/models/channel.model';
import { SeriesResponse } from '../../../shared/models/serie.model';
import { CustomizerSettingsService } from '../../../shared/components/customizer-settings/customizer-settings.service';
import {
    DialogConfig,
    GenericFormDialogComponent,
} from '../../../shared/components/dialogs/generic-form-dialog/generic-form-dialog.component';
import { DatePipe } from '@angular/common';

@Component({
    selector: 'app-channel-eras',
    imports: [
        MatTableModule,
        MatPaginatorModule,
        MatButtonModule,
        MatIconModule,
        MatDialogModule,
        MatSnackBarModule,
        MatCardModule,
        MatSelectModule,
        MatFormFieldModule,
        MatTooltipModule,
        RouterLink,
        DatePipe,
    ],
    templateUrl: './channel-eras.component.html',
    styleUrl: './channel-eras.component.scss',
})
export class ChannelErasComponent implements OnInit, AfterViewInit {
    @ViewChild(MatPaginator) paginator!: MatPaginator;

    channels = signal<ChannelResponse[]>([]);
    series = signal<SeriesResponse[]>([]);
    selectedChannelId = signal<number | null>(null);
    // Nombre del canal seleccionado (para el encabezado "Eras — <canal>").
    selectedChannelName = computed(() =>
        this.channels().find(c => c.id === this.selectedChannelId())?.name ?? null);
    displayedColumns = ['id', 'name', 'description', 'startDate', 'endDate', 'series', 'bumpers', 'actions'];
    dataSource = new MatTableDataSource<ChannelEraResponse>([]);

    constructor(
        private channelErasService: ChannelErasService,
        private channelsService: ChannelsService,
        private seriesService: SeriesService,
        private route: ActivatedRoute,
        private router: Router,
        private dialog: MatDialog,
        private snackBar: MatSnackBar,
        public themeService: CustomizerSettingsService,
    ) {}

    ngOnInit() {
        this.channelsService.getAll().subscribe({
            next: (data) => this.channels.set(data),
            error: () => this.showError('Error al cargar los canales'),
        });
        this.seriesService.getAll().subscribe({
            next: (data) => this.series.set(data),
        });
        // Deep-link desde Canales: preselecciona el canal y carga sus eras.
        const channelId = Number(this.route.snapshot.queryParamMap.get('channelId'));
        if (channelId) {
            this.selectedChannelId.set(channelId);
            this.loadEras(channelId);
        }
    }

    ngAfterViewInit() {
        this.dataSource.paginator = this.paginator;
    }

    onChannelChange(channelId: number) {
        this.selectedChannelId.set(channelId);
        this.loadEras(channelId);
    }

    loadEras(channelId: number) {
        this.channelErasService.getByChannel(channelId).subscribe({
            next: (data) => (this.dataSource.data = data),
            error: () => this.showError('Error al cargar las eras'),
        });
    }

    openForm(era?: ChannelEraResponse) {
        const channelId = this.selectedChannelId();
        if (!channelId) { this.showError('Seleccioná un canal primero'); return; }

        const config: DialogConfig = {
            title: 'era',
            fields: [
                { key: 'name', label: 'Nombre', type: 'text', validators: [Validators.required] },
                { key: 'description', label: 'Descripción', type: 'textarea' },
                {
                    key: 'startDate',
                    label: 'Fecha de inicio',
                    type: 'datepicker',
                    validators: [Validators.required],
                },
                { key: 'endDate', label: 'Fecha de fin', type: 'datepicker' },
            ],
            data: era ? { ...era } : null,
        };

        const dialogRef = this.dialog.open(GenericFormDialogComponent, {
            width: '500px',
            data: config,
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (!result) return;

            if (era) {
                this.channelErasService.update(era.id, result.data as ChannelEraRequest).subscribe({
                    next: () => {
                        this.loadEras(channelId);
                        this.showSuccess('Era actualizada');
                    },
                    error: () => this.showError('Error al actualizar la era'),
                });
            } else {
                this.channelErasService.create(channelId, result.data as ChannelEraRequest).subscribe({
                    next: () => {
                        this.loadEras(channelId);
                        this.showSuccess('Era creada');
                    },
                    error: () => this.showError('Error al crear la era'),
                });
            }
        });
    }

    // Los bumpers son propios de cada era: se gestionan desde la fila de la era.
    manageBumpers(era: ChannelEraResponse) {
        this.router.navigate(['/dashboard/channel-bumpers'], {
            queryParams: { channelId: this.selectedChannelId(), eraId: era.id },
        });
    }

    assignSeries(era: ChannelEraResponse) {
        const config: DialogConfig = {
            title: `series de ${era.name}`,
            fields: [
                {
                    key: 'seriesIds',
                    label: 'Series',
                    type: 'multiselect',
                    options: this.series().map((s) => ({ value: s.id, label: s.name })),
                },
            ],
            data: { seriesIds: era.seriesIds || [] },
        };

        const dialogRef = this.dialog.open(GenericFormDialogComponent, {
            width: '500px',
            data: config,
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (!result) return;
            const raw = result.data?.seriesIds ?? [];
            const seriesIds: number[] = Array.isArray(raw) ? raw.map((v: any) => Number(v)) : [];
            this.channelErasService.assignSeries(era.id, { seriesIds }).subscribe({
                next: () => {
                    this.loadEras(this.selectedChannelId()!);
                    this.showSuccess('Series asignadas');
                },
                error: () => this.showError('Error al asignar series'),
            });
        });
    }

    deleteEra(era: ChannelEraResponse) {
        this.channelErasService.delete(era.id).subscribe({
            next: () => {
                this.loadEras(this.selectedChannelId()!);
                this.showSuccess('Era eliminada');
            },
            error: () => this.showError('Error al eliminar la era'),
        });
    }

    getSeriesNames(seriesIds: number[]) {
        return seriesIds.map((id) => this.series().find((s) => s.id === id)?.name ?? id).join(', ');
    }

    private showSuccess(msg: string) {
        this.snackBar.open(msg, 'Cerrar', { duration: 3000 });
    }
    private showError(msg: string) {
        this.snackBar.open(msg, 'Cerrar', { duration: 3000, panelClass: 'error-snack' });
    }
}

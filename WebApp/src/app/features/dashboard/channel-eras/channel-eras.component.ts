import { Component, OnInit, signal, ViewChild, AfterViewInit } from '@angular/core';
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
    displayedColumns = ['id', 'name', 'description', 'startDate', 'endDate', 'series', 'bumpers', 'actions'];
    dataSource = new MatTableDataSource<ChannelEraResponse>([]);

    constructor(
        private channelErasService: ChannelErasService,
        private channelsService: ChannelsService,
        private seriesService: SeriesService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar,
        public themeService: CustomizerSettingsService,
    ) {}

    ngOnInit() {
        this.channelsService.getAll().subscribe({
            next: (data) => this.channels.set(data),
            error: () => this.showError('Error loading channels'),
        });
        this.seriesService.getAll().subscribe({
            next: (data) => this.series.set(data),
        });
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
            error: () => this.showError('Error loading eras'),
        });
    }

    openForm(era?: ChannelEraResponse) {
        const channelId = this.selectedChannelId();
        if (!channelId) { this.showError('Select a channel first'); return; }

        const config: DialogConfig = {
            title: era ? 'Edit Era' : 'New Era',
            fields: [
                { key: 'name', label: 'Name', type: 'text', validators: [Validators.required] },
                { key: 'description', label: 'Description', type: 'textarea' },
                {
                    key: 'startDate',
                    label: 'Start Date',
                    type: 'datepicker',
                    validators: [Validators.required],
                },
                { key: 'endDate', label: 'End Date', type: 'datepicker' },
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
                        this.showSuccess('Era updated');
                    },
                    error: () => this.showError('Error updating era'),
                });
            } else {
                this.channelErasService.create(channelId, result.data as ChannelEraRequest).subscribe({
                    next: () => {
                        this.loadEras(channelId);
                        this.showSuccess('Era created');
                    },
                    error: () => this.showError('Error creating era'),
                });
            }
        });
    }

    assignSeries(era: ChannelEraResponse) {
        const config: DialogConfig = {
            title: `Assign Series — ${era.name}`,
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
                    this.showSuccess('Series assigned');
                },
                error: () => this.showError('Error assigning series'),
            });
        });
    }

    deleteEra(era: ChannelEraResponse) {
        this.channelErasService.delete(era.id).subscribe({
            next: () => {
                this.loadEras(this.selectedChannelId()!);
                this.showSuccess('Era deleted');
            },
            error: () => this.showError('Error deleting era'),
        });
    }

    getSeriesNames(seriesIds: number[]) {
        return seriesIds.map((id) => this.series().find((s) => s.id === id)?.name ?? id).join(', ');
    }

    private showSuccess(msg: string) {
        this.snackBar.open(msg, 'Close', { duration: 3000 });
    }
    private showError(msg: string) {
        this.snackBar.open(msg, 'Close', { duration: 3000, panelClass: 'error-snack' });
    }
}

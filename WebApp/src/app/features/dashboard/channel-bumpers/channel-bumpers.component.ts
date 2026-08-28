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
import { MatTooltipModule } from '@angular/material/tooltip';
import { Validators } from '@angular/forms';
import { ChannelBumpersService } from './channel-bumpers.service';
import { ChannelErasService } from '../channel-eras/channel-eras.service';
import { ChannelsService } from '../channels/channels.service';
import { ChannelBumperResponse, ChannelEraResponse } from '../../../shared/models/channel-era.model';
import { ChannelResponse } from '../../../shared/models/channel.model';
import { CustomizerSettingsService } from '../../../shared/components/customizer-settings/customizer-settings.service';
import {
    DialogConfig,
    GenericFormDialogComponent,
} from '../../../shared/components/dialogs/generic-form-dialog/generic-form-dialog.component';
import { environment } from '../../../../environments/environment';

@Component({
    selector: 'app-channel-bumpers',
    imports: [
        MatTableModule, MatPaginatorModule, MatButtonModule, MatIconModule,
        MatDialogModule, MatSnackBarModule, MatCardModule, MatSelectModule,
        MatFormFieldModule, MatTooltipModule,
    ],
    templateUrl: './channel-bumpers.component.html',
    styleUrl: './channel-bumpers.component.scss',
})
export class ChannelBumpersComponent implements OnInit, AfterViewInit {
    @ViewChild(MatPaginator) paginator!: MatPaginator;

    channels = signal<ChannelResponse[]>([]);
    eras = signal<ChannelEraResponse[]>([]);
    selectedChannelId = signal<number | null>(null);
    selectedEraId = signal<number | null>(null);
    displayedColumns = ['id', 'title', 'filePath', 'order', 'actions'];
    dataSource = new MatTableDataSource<ChannelBumperResponse>([]);
    apiUrl = environment.apiUrl;

    constructor(
        private bumpersService: ChannelBumpersService,
        private erasService: ChannelErasService,
        private channelsService: ChannelsService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar,
        public themeService: CustomizerSettingsService,
    ) {}

    ngOnInit() {
        this.channelsService.getAll().subscribe({
            next: (data) => this.channels.set(data),
            error: () => this.showError('Error loading channels'),
        });
    }

    ngAfterViewInit() {
        this.dataSource.paginator = this.paginator;
    }

    onChannelChange(channelId: number) {
        this.selectedChannelId.set(channelId);
        this.selectedEraId.set(null);
        this.dataSource.data = [];
        this.erasService.getByChannel(channelId).subscribe({
            next: (data) => this.eras.set(data),
            error: () => this.showError('Error loading eras'),
        });
    }

    onEraChange(eraId: number) {
        this.selectedEraId.set(eraId);
        this.loadBumpers(eraId);
    }

    loadBumpers(eraId: number) {
        this.bumpersService.getByEra(eraId).subscribe({
            next: (data) => (this.dataSource.data = data),
            error: () => this.showError('Error loading bumpers'),
        });
    }

    openForm(bumper?: ChannelBumperResponse) {
        const eraId = this.selectedEraId();
        if (!eraId) { this.showError('Select an era first'); return; }

        const config: DialogConfig = {
            title: bumper ? 'Edit Bumper' : 'New Bumper',
            fields: [
                { key: 'title', label: 'Title', type: 'text', validators: [Validators.required] },
                { key: 'file', label: 'Video File', type: 'file' },
                { key: 'order', label: 'Order', type: 'number' },
            ],
            data: bumper ? { ...bumper } : { order: 0 },
        };

        const dialogRef = this.dialog.open(GenericFormDialogComponent, {
            width: '500px',
            data: config,
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (!result) return;

            const formData = new FormData();
            const data = result.data;
            formData.append('title', data.title);
            formData.append('order', data.order ?? 0);
            if (data.file) {
                formData.append('file', data.file);
            }

            if (bumper) {
                this.bumpersService.update(bumper.id, formData).subscribe({
                    next: () => {
                        this.loadBumpers(eraId);
                        this.showSuccess('Bumper updated');
                    },
                    error: () => this.showError('Error updating bumper'),
                });
            } else {
                this.bumpersService.create(eraId, formData).subscribe({
                    next: () => {
                        this.loadBumpers(eraId);
                        this.showSuccess('Bumper created');
                    },
                    error: () => this.showError('Error creating bumper'),
                });
            }
        });
    }

    deleteBumper(bumper: ChannelBumperResponse) {
        this.bumpersService.delete(bumper.id).subscribe({
            next: () => {
                this.loadBumpers(this.selectedEraId()!);
                this.showSuccess('Bumper deleted');
            },
            error: () => this.showError('Error deleting bumper'),
        });
    }

    scan() {
        if (!this.selectedEraId()) { this.showError('Select an era first'); return; }
        this.bumpersService.scan(this.selectedEraId()!).subscribe({
            next: (data) => {
                this.dataSource.data = data;
                this.showSuccess('Bumpers synced from folder');
            },
            error: () => this.showError('Error scanning folder'),
        });
    }

    getVideoUrl(filePath: string): string {
        if (!filePath) return '';
        const clean = filePath.replace('wwwroot', '').replace(/\\/g, '/');
        return `${this.apiUrl}${clean}`;
    }

    private showSuccess(msg: string) {
        this.snackBar.open(msg, 'Close', { duration: 3000 });
    }
    private showError(msg: string) {
        this.snackBar.open(msg, 'Close', { duration: 3000, panelClass: 'error-snack' });
    }
}

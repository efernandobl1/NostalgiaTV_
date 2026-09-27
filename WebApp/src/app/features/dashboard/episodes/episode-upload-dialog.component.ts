import { Component, ElementRef, inject, signal, computed, viewChild } from '@angular/core';
import { HttpErrorResponse, HttpEventType, HttpResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { SeriesService } from '../series/series.service';
import { SeriesUploadResult } from '../../../shared/models/serie.model';
import { CustomizerSettingsService } from '../../../shared/components/customizer-settings/customizer-settings.service';

export type UploadTarget = 'season' | 'specials' | 'movies';

export interface EpisodeUploadDialogData {
    seriesId: number;
    seriesName: string;
    maxSeason: number;
}

export interface EpisodeUploadDialogResult {
    uploaded: number;
    failed: number;
}

interface UploadItem {
    file: File;
    progress: number;
    status: 'pending' | 'uploading' | 'done' | 'error';
    error?: string;
}

@Component({
    selector: 'app-episode-upload-dialog',
    imports: [
        MatCardModule, MatDialogModule, MatFormFieldModule, MatSelectModule,
        MatButtonModule, MatIconModule, MatProgressBarModule
    ],
    templateUrl: './episode-upload-dialog.component.html',
    styleUrl: './episode-upload-dialog.component.scss'
})
export class EpisodeUploadDialogComponent {
    readonly data = inject<EpisodeUploadDialogData>(MAT_DIALOG_DATA);
    private readonly dialogRef = inject(MatDialogRef<EpisodeUploadDialogComponent>);
    private readonly seriesService = inject(SeriesService);
    readonly themeService = inject(CustomizerSettingsService);

    // Mismos contenedores reproducibles en HTML5 que acepta el escáner de carpetas.
    readonly allowedExtensions = ['.mp4', '.m4v', '.webm', '.ogg', '.ogv', '.mov'];

    readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

    readonly target = signal<UploadTarget>('season');
    readonly season = signal(Math.max(this.data.maxSeason, 1));
    readonly items = signal<UploadItem[]>([]);
    readonly uploading = signal(false);

    readonly pendingCount = computed(() => this.items().filter(i => i.status === 'pending' || i.status === 'error').length);
    readonly canUpload = () => !this.uploading() && this.pendingCount() > 0;

    seasonOptions(): number[] {
        const max = Math.max(this.data.maxSeason, 1);
        return Array.from({ length: max }, (_, i) => i + 1);
    }

    onFilesPicked(event: Event) {
        const input = event.target as HTMLInputElement;
        const picked = Array.from(input.files ?? []);
        input.value = '';
        const existing = new Set(this.items().map(i => i.file.name + i.file.size));
        const fresh = picked.filter(f => !existing.has(f.name + f.size));
        this.items.update(list => [...list, ...fresh.map(file => ({ file, progress: 0, status: 'pending' as const }))]);
    }

    openFilePicker() {
        if (this.uploading()) return;
        this.fileInput()?.nativeElement.click();
    }

    removeItem(index: number) {
        if (this.uploading()) return;
        this.items.update(list => list.filter((_, i) => i !== index));
    }

    formatSize(bytes: number): string {
        if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    async uploadAll() {
        if (!this.canUpload()) return;
        this.uploading.set(true);
        for (const item of this.items().filter(i => i.status === 'pending' || i.status === 'error')) {
            await this.uploadOne(item);
        }
        this.uploading.set(false);
    }

    private uploadOne(item: UploadItem): Promise<void> {
        this.patch(item, { status: 'uploading', progress: 0, error: undefined });
        return new Promise(resolve => {
            const formData = new FormData();
            formData.append('files', item.file, item.file.name);
            formData.append('target', this.target());
            if (this.target() === 'season') formData.append('season', String(this.season()));
            this.seriesService.uploadFiles(this.data.seriesId, formData).subscribe({
                next: event => {
                    if (event.type === HttpEventType.UploadProgress && event.total) {
                        this.patch(item, { progress: Math.min(100, Math.round((event.loaded * 100) / event.total)) });
                    } else if (event instanceof HttpResponse) {
                        const failed = (event.body ?? []).filter(r => !r.success);
                        if (failed.length) {
                            this.patch(item, { status: 'error', progress: 100, error: failed.map((r: SeriesUploadResult) => r.error).join('; ') });
                        } else {
                            this.patch(item, { status: 'done', progress: 100 });
                        }
                        resolve();
                    }
                },
                error: (err: HttpErrorResponse) => {
                    this.patch(item, { status: 'error', error: this.extractError(err) });
                    resolve();
                }
            });
        });
    }

    private extractError(err: HttpErrorResponse): string {
        const detail = err.error?.detail;
        if (typeof detail === 'string' && detail) return detail;
        if (err.status === 0) return 'Error de conexión o archivo demasiado grande.';
        return err.message ?? 'Error desconocido';
    }

    private patch(item: UploadItem, changes: Partial<UploadItem>) {
        this.items.update(list => list.map(i => (i.file === item.file ? { ...i, ...changes } : i)));
    }

    close() {
        if (this.uploading()) return;
        const uploaded = this.items().filter(i => i.status === 'done').length;
        const failed = this.items().filter(i => i.status === 'error').length;
        this.dialogRef.close(uploaded || failed ? { uploaded, failed } : undefined);
    }
}

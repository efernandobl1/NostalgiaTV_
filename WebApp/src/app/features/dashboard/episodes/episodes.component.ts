import { Component, OnInit, signal, computed, ViewChild, AfterViewInit } from '@angular/core';
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
import { FormsModule } from '@angular/forms';
import { EpisodesService } from './episodes.service';
import { SeriesService } from '../series/series.service';
import { EpisodeResponse, UpdateEpisodeRequest } from '../../../shared/models/episode.model';
import { SeriesResponse } from '../../../shared/models/serie.model';
import { CustomizerSettingsService } from '../../../shared/components/customizer-settings/customizer-settings.service';
import { DialogConfig, GenericFormDialogComponent } from '../../../shared/components/dialogs/generic-form-dialog/generic-form-dialog.component';

@Component({
    selector: 'app-episodes',
    imports: [
        MatTableModule, MatPaginatorModule, MatButtonModule, MatIconModule,
        MatDialogModule, MatSnackBarModule, MatCardModule, MatSelectModule,
        MatFormFieldModule, MatTooltipModule, FormsModule
    ],
    templateUrl: './episodes.component.html',
    styleUrl: './episodes.component.scss'
})
export class EpisodesComponent implements OnInit, AfterViewInit {

    @ViewChild(MatPaginator) paginator!: MatPaginator;

    series = signal<SeriesResponse[]>([]);
    selectedSeriesId = signal<number | null>(null);
    selectedSeason = signal<number | null>(null);

    episodeTypes = signal<{ id: number; name: string }[]>([
        { id: 1, name: 'Regular' },
        { id: 2, name: 'Special' },
        { id: 3, name: 'Christmas Special' },
        { id: 4, name: 'Halloween Special' },
        { id: 5, name: 'Movie' }
    ]);

    private allEpisodes = signal<EpisodeResponse[]>([]);

    seasons = computed(() => {
        const nums = [...new Set(this.allEpisodes().map(e => e.season))].sort((a, b) => a - b);
        return nums;
    });

    dataSource = new MatTableDataSource<EpisodeResponse>([]);
    displayedColumns = ['id', 'season', 'episodeNumber', 'title', 'type', 'filePath', 'actions'];

    constructor(
        private episodesService: EpisodesService,
        private seriesService: SeriesService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar,
        public themeService: CustomizerSettingsService
    ) {}

    ngOnInit() {
        this.seriesService.getAll().subscribe({
            next: data => this.series.set(data),
            error: () => this.showError('Error loading series')
        });
    }

    ngAfterViewInit() {
        this.dataSource.paginator = this.paginator;
    }

    onSeriesChange(seriesId: number) {
        this.selectedSeriesId.set(seriesId);
        this.selectedSeason.set(null);
        this.loadEpisodes(seriesId);
    }

    onSeasonChange(season: number | null) {
        this.selectedSeason.set(season);
        this.applySeasonFilter(season);
    }

    loadEpisodes(seriesId: number) {
        this.episodesService.getBySeries(seriesId).subscribe({
            next: data => {
                this.allEpisodes.set(data);
                this.dataSource.data = data;
            },
            error: () => this.showError('Error loading episodes')
        });
    }

    private applySeasonFilter(season: number | null) {
        const all = this.allEpisodes();
        this.dataSource.data = season === null ? all : all.filter(e => e.season === season);
        if (this.paginator) this.paginator.firstPage();
    }

    scan() {
        if (!this.selectedSeriesId()) { this.showError('Select a series first'); return; }
        this.episodesService.scan(this.selectedSeriesId()!).subscribe({
            next: data => {
                this.allEpisodes.set(data);
                this.dataSource.data = data;
                this.selectedSeason.set(null);
                this.showSuccess('Episodes synced from folder');
            },
            error: () => this.showError('Error scanning folder')
        });
    }

    editEpisode(episode: EpisodeResponse) {
        const config: DialogConfig = {
            title: 'Edit Episode',
            fields: [
                { key: 'title', label: 'Title', type: 'text' },
                { key: 'episodeNumber', label: 'Episode Number', type: 'number' },
                {
                    key: 'episodeTypeId',
                    label: 'Type',
                    type: 'select',
                    options: this.episodeTypes().map(t => ({ value: t.id, label: t.name }))
                }
            ],
            data: {
                title: episode.title,
                episodeNumber: episode.episodeNumber,
                episodeTypeId: episode.episodeTypeId
            }
        };

        const dialogRef = this.dialog.open(GenericFormDialogComponent, {
            width: '400px',
            data: config,
            panelClass: this.themeService.isDark() ? 'dark-theme' : ''
        });

        dialogRef.afterClosed().subscribe(result => {
            if (!result) return;
            const request: UpdateEpisodeRequest = {
                title: result.data.title,
                episodeNumber: +result.data.episodeNumber,
                episodeTypeId: +result.data.episodeTypeId
            };
            this.episodesService.update(episode.id, request).subscribe({
                next: updated => {
                    this.allEpisodes.update(list => list.map(e => e.id === updated.id ? updated : e));
                    this.applySeasonFilter(this.selectedSeason());
                    this.showSuccess('Episode updated');
                },
                error: () => this.showError('Error updating episode')
            });
        });
    }

    private showSuccess(msg: string) {
        this.snackBar.open(msg, 'Close', { duration: 3000 });
    }

    private showError(msg: string) {
        this.snackBar.open(msg, 'Close', { duration: 3000, panelClass: 'error-snack' });
    }
}

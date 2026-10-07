import { AsyncPipe } from '@angular/common';
import {
  Component,
  OnInit,
  signal,
  computed,
  ViewChild,
  AfterViewInit,
  input,
  effect,
} from '@angular/core';
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
import { ActivatedRoute } from '@angular/router';
import { EpisodesService } from './episodes.service';
import { EpisodeUploadDialogComponent } from './episode-upload-dialog.component';
import { SeriesService } from '../series/series.service';
import { EpisodeResponse, UpdateEpisodeRequest } from '../../../shared/models/episode.model';
import { SeriesResponse } from '../../../shared/models/serie.model';
import { CustomizerSettingsService } from '../../../shared/components/customizer-settings/customizer-settings.service';
import {
  DialogConfig,
  GenericFormDialogComponent,
} from '../../../shared/components/dialogs/generic-form-dialog/generic-form-dialog.component';
import { BreakPointsComponent } from './break-points.component';
import { MenuService } from '../../../core/services/menu.service';

@Component({
  selector: 'app-episodes',
  imports: [
    AsyncPipe,
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
    FormsModule,
    BreakPointsComponent,
  ],
  templateUrl: './episodes.component.html',
  styleUrl: './episodes.component.scss',
})
export class EpisodesComponent implements OnInit, AfterViewInit {
  readonly seriesId = input<number | null>(null);
  readonly expandedId = signal<number | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly scanning = signal(false);
  private readonly syncSeries = effect(() => {
    const id = this.seriesId();
    if (id) this.onSeriesChange(id);
  });

  paginator?: MatPaginator;
  @ViewChild(MatPaginator) set page(paginator: MatPaginator) {
    if (paginator) {
      this.paginator = paginator;
      this.dataSource.paginator = paginator;
    }
  }

  series = signal<SeriesResponse[]>([]);
  selectedSeriesId = signal<number | null>(null);
  selectedSeason = signal<number | null>(null);
  readonly filtersOpen = signal(false);
  readonly search = signal('');
  readonly selectedType = signal<number | null>(null);
  readonly activeFilterCount = computed(
    () => Number(!!this.search().trim()) + Number(this.selectedType() !== null),
  );
  // Nombre de la serie seleccionada (encabezado "Episodios — <serie>").
  selectedSeriesName = computed(
    () => this.series().find((s) => s.id === this.selectedSeriesId())?.name ?? null,
  );

  episodeTypes = signal<{ id: number; name: string }[]>([
    { id: 1, name: 'Regular' },
    { id: 2, name: 'Especial' },
    { id: 3, name: 'Especial de Navidad' },
    { id: 4, name: 'Especial de Halloween' },
    { id: 5, name: 'Película' },
  ]);

  readonly allEpisodes = signal<EpisodeResponse[]>([]);
  readonly filteredEpisodes = computed(() => {
    const season = this.selectedSeason();
    const type = this.selectedType();
    const query = this.normalize(this.search().trim());
    const episodeNumber = /^\d+$/.test(query) ? Number(query) : null;
    return this.allEpisodes()
      .filter(
        (episode) =>
          (season === null || episode.season === season) &&
          (type === null || episode.episodeTypeId === type) &&
          (!query ||
            (episodeNumber !== null
              ? episode.episodeNumber === episodeNumber
              : this.normalize(episode.title).includes(query))),
      )
      .sort((a, b) => a.season - b.season || a.episodeNumber - b.episodeNumber || a.id - b.id);
  });
  readonly totalSizeBytes = computed(() =>
    this.allEpisodes().reduce((total, episode) => total + (episode.fileSizeBytes ?? 0), 0),
  );

  formatSize(bytes: number | null | undefined): string {
    if (bytes == null) return 'Peso no disponible';
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** unit).toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
  }

  seasons = computed(() => {
    const nums = [...new Set(this.allEpisodes().map((e) => e.season))].sort((a, b) => a - b);
    return nums;
  });

  dataSource = new MatTableDataSource<EpisodeResponse>([]);
  private readonly syncEpisodes = effect(() => {
    this.dataSource.data = this.filteredEpisodes();
    this.paginator?.firstPage();
  });
  displayedColumns = ['id', 'season', 'episodeNumber', 'title', 'type', 'filePath', 'actions'];

  constructor(
    private episodesService: EpisodesService,
    private seriesService: SeriesService,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    public themeService: CustomizerSettingsService,
    public menuService: MenuService,
  ) {}

  ngOnInit() {
    this.seriesService.getAll().subscribe({
      next: (data) => this.series.set(data),
      error: () => this.showError('Error al cargar las series'),
    });
    // Deep-link desde Series: preselecciona la serie y carga sus episodios.
    const seriesId = Number(this.route.snapshot.queryParamMap.get('seriesId'));
    if (seriesId) {
      this.selectedSeriesId.set(seriesId);
      this.loadEpisodes(seriesId);
    }
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
  }

  onSeriesChange(seriesId: number) {
    this.selectedSeriesId.set(seriesId);
    this.selectedSeason.set(null);
    this.clearFilters();
    this.allEpisodes.set([]);
    this.loadEpisodes(seriesId);
  }

  onSeasonChange(season: number | null) {
    this.selectedSeason.set(season);
    this.expandedId.set(null);
  }

  loadEpisodes(seriesId: number) {
    this.loading.set(true);
    this.loadError.set(false);
    this.expandedId.set(null);
    this.episodesService.getBySeries(seriesId).subscribe({
      next: (data) => {
        if (this.selectedSeriesId() !== seriesId) return;
        this.allEpisodes.set(data);
        this.loading.set(false);
      },
      error: () => {
        if (this.selectedSeriesId() !== seriesId) return;
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  clearFilters() {
    this.search.set('');
    this.selectedType.set(null);
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es');
  }

  scan() {
    if (this.scanning()) return;
    if (!this.selectedSeriesId()) {
      this.showError('Seleccioná una serie primero');
      return;
    }
    this.scanning.set(true);
    const seriesId = this.selectedSeriesId()!;
    this.episodesService.scan(seriesId).subscribe({
      next: (data) => {
        this.scanning.set(false);
        if (this.selectedSeriesId() !== seriesId) return;
        this.allEpisodes.set(data);
        this.showSuccess('Episodios sincronizados desde la carpeta');
      },
      error: () => {
        this.scanning.set(false);
        this.showError('Error al escanear la carpeta');
      },
    });
  }

  openUpload() {
    const seriesId = this.selectedSeriesId();
    if (!seriesId) {
      this.showError('Seleccioná una serie primero');
      return;
    }
    const serie = this.series().find((s) => s.id === seriesId);
    const existingSeasons = this.allEpisodes()
      .map((e) => e.season)
      .filter((n) => n > 0);
    const maxSeason = Math.max(serie?.seasons ?? 1, ...existingSeasons, 1);
    const dialogRef = this.dialog.open(EpisodeUploadDialogComponent, {
      width: '620px',
      data: { seriesId, seriesName: serie?.name ?? '', maxSeason },
      panelClass: this.themeService.isDark() ? 'dark-theme' : '',
      disableClose: true,
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;
      if (result.failed > 0) this.showError(`${result.failed} archivo(s) no se pudieron subir`);
      if (result.uploaded > 0) this.scan();
    });
  }

  editEpisode(episode: EpisodeResponse) {
    const config: DialogConfig = {
      title: 'episodio',
      fields: [
        { key: 'title', label: 'Título', type: 'text' },
        { key: 'episodeNumber', label: 'Número de episodio', type: 'number' },
        {
          key: 'episodeTypeId',
          label: 'Tipo',
          type: 'select',
          options: this.episodeTypes().map((t) => ({ value: t.id, label: t.name })),
        },
      ],
      data: {
        title: episode.title,
        episodeNumber: episode.episodeNumber,
        episodeTypeId: episode.episodeTypeId,
      },
    };

    const dialogRef = this.dialog.open(GenericFormDialogComponent, {
      width: '400px',
      data: config,
      panelClass: this.themeService.isDark() ? 'dark-theme' : '',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;
      const request: UpdateEpisodeRequest = {
        title: result.data.title,
        episodeNumber: +result.data.episodeNumber,
        episodeTypeId: +result.data.episodeTypeId,
      };
      this.episodesService.update(episode.id, request).subscribe({
        next: (updated) => {
          this.allEpisodes.update((list) => list.map((e) => (e.id === updated.id ? updated : e)));
          this.showSuccess('Episodio actualizado');
        },
        error: () => this.showError('Error al actualizar el episodio'),
      });
    });
  }

  private showSuccess(msg: string) {
    this.snackBar.open(msg, 'Cerrar', { duration: 5000 });
  }

  private showError(msg: string) {
    this.snackBar.open(msg, 'Cerrar', {
      duration: 0,
      panelClass: 'error-snack',
      politeness: 'assertive',
    });
  }
}

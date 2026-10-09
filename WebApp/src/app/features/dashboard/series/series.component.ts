import { AsyncPipe } from '@angular/common';
import { StorageComponent, formatBytes } from '../storage/storage.component';
import { SeriesStorage, StorageResponse } from '../../../shared/models/dashboard.model';
import { SeriesEditorComponent } from './series-editor.component';
import { map } from 'rxjs';
import { Component, OnInit, ViewChild, signal } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SeriesService } from './series.service';
import { CategoriesService } from '../categories/categories.service';
import { SeriesResponse } from '../../../shared/models/serie.model';
import { CategoryResponse } from '../../../shared/models/category.model';
import {
  DialogConfig,
  GenericFormDialogComponent,
} from '../../../shared/components/dialogs/generic-form-dialog/generic-form-dialog.component';
import { CustomizerSettingsService } from '../../../shared/components/customizer-settings/customizer-settings.service';
import { environment } from '../../../../environments/environment';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-series',
  imports: [
    SeriesEditorComponent,
    StorageComponent,
    AsyncPipe,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatCardModule,
    MatTooltipModule,
  ],
  templateUrl: './series.component.html',
  styleUrl: './series.component.scss',
})
export class SeriesComponent implements OnInit {
  readonly apiUrl = environment.apiUrl;
  readonly editorOpen = signal(false);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly editingSeries = signal<SeriesResponse | null>(null);
  readonly editorTab = signal<'data' | 'episodes'>('data');
  readonly storageBySeries = signal<Record<number, SeriesStorage>>({});
  readonly size = formatBytes;
  private sortBy = 'name';

  setStorage(data: StorageResponse): void {
    this.storageBySeries.set(Object.fromEntries(data.series.map((item) => [item.id, item])));
    this.sortSeries(this.sortBy);
  }

  sortSeries(order: string): void {
    this.sortBy = order;
    this.dataSource.data = [...this.dataSource.data].sort((first, second) => {
      const difference =
        order === 'size'
          ? (this.storageBySeries()[second.id]?.sizeBytes ?? -1) -
            (this.storageBySeries()[first.id]?.sizeBytes ?? -1)
          : order === 'episodes'
            ? (second.episodeCount ?? 0) - (first.episodeCount ?? 0)
            : 0;
      return difference || first.name.localeCompare(second.name);
    });
    this.paginator?.firstPage();
  }

  paginator!: MatPaginator;
  @ViewChild(MatPaginator) set page(value: MatPaginator) {
    if (value) {
      this.paginator = value;
      this.dataSource.paginator = value;
    }
  }

  categories = signal<CategoryResponse[]>([]);
  readonly filtersOpen = signal(false);
  private searchTerm = '';
  private incompleteOnly = false;
  private initialSeriesOpened = false;
  toggleFilters(): void {
    this.filtersOpen.update((value) => !value);
  }

  filterIncomplete(checked: boolean): void {
    this.incompleteOnly = checked;
    this.applyFilter();
  }

  search(value: string): void {
    this.searchTerm = value.trim().toLocaleLowerCase();
    this.applyFilter();
  }

  private applyFilter(): void {
    this.dataSource.filter = JSON.stringify([this.searchTerm, this.incompleteOnly]);
    this.paginator?.firstPage();
  }
  displayedColumns = [
    'id',
    'name',
    'description',
    'startDate',
    'endDate',
    'rating',
    'categories',
    'actions',
  ];
  dataSource = new MatTableDataSource<SeriesResponse>([]);

  constructor(
    private seriesService: SeriesService,
    private categoriesService: CategoriesService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private route: ActivatedRoute,
    public themeService: CustomizerSettingsService,
  ) {}

  // Los episodios son propios de cada serie: se gestionan desde la fila de la
  // serie (deep-link con la serie preseleccionada) en vez de un menú suelto.
  manageEpisodes(series: SeriesResponse) {
    this.editingSeries.set(series);
    this.editorTab.set('episodes');
    this.editorOpen.set(true);
  }

  ngOnInit() {
    this.dataSource.filterPredicate = (series) =>
      (!this.incompleteOnly || !series.logoPath || !series.categoryIds.length) &&
      series.name.toLocaleLowerCase().includes(this.searchTerm);
    this.loadSeries();
    if (this.route.snapshot.queryParamMap.get('new') === '1') {
      this.openForm();
    }
    this.categoriesService.getAll().subscribe({
      next: (data) => this.categories.set(data),
      error: () => this.showError('Error al cargar las categorías'),
    });
  }

  loadSeries() {
    this.loading.set(true);
    this.loadError.set(false);
    this.seriesService.getAll().subscribe({
      next: (data) => {
        this.dataSource.data = data;
        this.sortSeries(this.sortBy);
        this.loading.set(false);
        const requestedId = Number(this.route.snapshot.queryParamMap.get('seriesId'));
        if (requestedId && !this.initialSeriesOpened) {
          const series = data.find((item) => item.id === requestedId);
          if (series) {
            this.initialSeriesOpened = true;
            this.openForm(series);
          }
        }
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  delete(id: number) {
    if (!confirm('¿Eliminar esta serie? No podrás recuperar sus datos desde el panel.')) return;
    this.seriesService.delete(id).subscribe({
      next: () => {
        this.dataSource.data = this.dataSource.data.filter((s) => s.id !== id);
        this.showSuccess('Serie eliminada');
      },
      error: () => this.showError('Error al eliminar la serie'),
    });
  }

  openForm(series?: SeriesResponse): void {
    this.editingSeries.set(series ?? null);
    this.editorTab.set('data');
    this.editorOpen.set(true);
  }

  assignCategories(series: SeriesResponse) {
    const config: DialogConfig = {
      title: 'categorías de la serie',
      fields: [
        {
          key: 'categoryIds',
          label: 'Categorías',
          type: 'multiselect',
          options: this.categories().map((c) => ({ value: c.id, label: c.name })),
          // Crear una categoría nueva sin salir del diálogo (workflow inline).
          creatable: true,
          onCreate: (name: string) =>
            this.categoriesService.create({ name }).pipe(
              map((c) => {
                this.categories.set([...this.categories(), c]);
                return { value: c.id, label: c.name };
              }),
            ),
        },
      ],
      data: { categoryIds: series.categoryIds },
    };

    const dialogRef = this.dialog.open(GenericFormDialogComponent, {
      width: '500px',
      data: config,
      panelClass: this.themeService.isDark() ? 'dark-theme' : '',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;
      this.seriesService.assignCategories(series.id, result.data.categoryIds).subscribe({
        next: (updated) => {
          this.dataSource.data = this.dataSource.data.map((s) =>
            s.id === updated.id ? updated : s,
          );
          this.showSuccess('Categorías asignadas');
        },
        error: () => this.showError('Error al asignar categorías'),
      });
    });
  }

  getCategoryNames(categoryIds: number[]) {
    return categoryIds
      .map((id) => this.categories().find((c) => c.id === id)?.name ?? id)
      .join(', ');
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

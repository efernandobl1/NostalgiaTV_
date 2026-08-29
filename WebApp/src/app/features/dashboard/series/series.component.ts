import { map } from 'rxjs';
import { Component, OnInit, ViewChild, AfterViewInit, signal } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SeriesService } from './series.service';
import { CategoriesService } from '../categories/categories.service';
import { SeriesResponse } from '../../../shared/models/serie.model';
import { CategoryResponse } from '../../../shared/models/category.model';
import { DialogConfig, GenericFormDialogComponent } from '../../../shared/components/dialogs/generic-form-dialog/generic-form-dialog.component';
import { CustomizerSettingsService } from '../../../shared/components/customizer-settings/customizer-settings.service';
import { DatePipe } from '@angular/common';

@Component({
    selector: 'app-series',
    imports: [MatTableModule, MatPaginatorModule, MatButtonModule, MatIconModule, MatDialogModule, MatSnackBarModule, MatCardModule, MatTooltipModule, DatePipe],
    templateUrl: './series.component.html',
    styleUrl: './series.component.scss',
})
export class SeriesComponent implements OnInit, AfterViewInit {

    @ViewChild(MatPaginator) paginator!: MatPaginator;

    categories = signal<CategoryResponse[]>([]);
    displayedColumns = ['id', 'name', 'description', 'startDate', 'endDate', 'rating', 'categories', 'actions'];
    dataSource = new MatTableDataSource<SeriesResponse>([]);

    constructor(
        private seriesService: SeriesService,
        private categoriesService: CategoriesService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar,
        private router: Router,
        public themeService: CustomizerSettingsService,
    ) {}

    // Los episodios son propios de cada serie: se gestionan desde la fila de la
    // serie (deep-link con la serie preseleccionada) en vez de un menú suelto.
    manageEpisodes(series: SeriesResponse) {
        this.router.navigate(['/dashboard/episodes'], { queryParams: { seriesId: series.id } });
    }

    ngOnInit() {
        this.loadSeries();
        this.categoriesService.getAll().subscribe({
            next: data => this.categories.set(data),
            error: () => this.showError('Error al cargar las categorías'),
        });
    }

    ngAfterViewInit() { this.dataSource.paginator = this.paginator; }

    loadSeries() {
        this.seriesService.getAll().subscribe({
            next: data => this.dataSource.data = data,
            error: () => this.showError('Error al cargar las series'),
        });
    }

    delete(id: number) {
        this.seriesService.delete(id).subscribe({
            next: () => {
                this.dataSource.data = this.dataSource.data.filter(s => s.id !== id);
                this.showSuccess('Serie eliminada');
            },
            error: () => this.showError('Error al eliminar la serie'),
        });
    }

    openForm(series?: SeriesResponse) {
        const config: DialogConfig = {
            title: 'serie',
            fields: [
                { key: 'name', label: 'Nombre', type: 'text', validators: [Validators.required, Validators.maxLength(100)] },
                { key: 'description', label: 'Descripción', type: 'textarea' },
                { key: 'history', label: 'Historia', type: 'textarea' },
                { key: 'logo', label: 'Logo', type: 'file' },
                { key: 'startDate', label: 'Fecha de inicio', type: 'datepicker', validators: [Validators.required] },
                { key: 'endDate', label: 'Fecha de fin', type: 'datepicker' },
                { key: 'rating', label: 'Calificación', type: 'number' },
                { key: 'seasons', label: 'Temporadas', type: 'number', validators: [Validators.required, Validators.min(1)] },
            ],
            data: series ?? null,
        };

        const dialogRef = this.dialog.open(GenericFormDialogComponent, {
            width: '500px', data: config,
            panelClass: this.themeService.isDark() ? 'dark-theme' : '',
        });

        dialogRef.afterClosed().subscribe(result => {
            if (!result) return;
            let payload: FormData;
            if (result.isMultipart) {
                payload = result.formData;
            } else {
                payload = new FormData();
                Object.keys(result.data).forEach(key => {
                    if (result.data[key] !== null && result.data[key] !== undefined && result.data[key] !== '')
                        payload.append(key, result.data[key]);
                });
            }
            if (series) {
                this.seriesService.update(series.id, payload).subscribe({
                    next: updated => {
                        this.dataSource.data = this.dataSource.data.map(s => s.id === updated.id ? updated : s);
                        this.showSuccess('Serie actualizada');
                    },
                    error: () => this.showError('Error al actualizar la serie'),
                });
            } else {
                this.seriesService.create(payload).subscribe({
                    next: created => {
                        this.dataSource.data = [...this.dataSource.data, created];
                        this.showSuccess('Serie creada');
                    },
                    error: () => this.showError('Error al crear la serie'),
                });
            }
        });
    }

    assignCategories(series: SeriesResponse) {
        const config: DialogConfig = {
            title: 'categorías de la serie',
            fields: [{
                key: 'categoryIds',
                label: 'Categorías',
                type: 'multiselect',
                options: this.categories().map(c => ({ value: c.id, label: c.name })),
                // Crear una categoría nueva sin salir del diálogo (workflow inline).
                creatable: true,
                onCreate: (name: string) => this.categoriesService.create({ name }).pipe(
                    map(c => {
                        this.categories.set([...this.categories(), c]);
                        return { value: c.id, label: c.name };
                    })
                ),
            }],
            data: { categoryIds: series.categoryIds },
        };

        const dialogRef = this.dialog.open(GenericFormDialogComponent, {
            width: '500px', data: config,
            panelClass: this.themeService.isDark() ? 'dark-theme' : '',
        });

        dialogRef.afterClosed().subscribe(result => {
            if (!result) return;
            this.seriesService.assignCategories(series.id, result.data.categoryIds).subscribe({
                next: updated => {
                    this.dataSource.data = this.dataSource.data.map(s => s.id === updated.id ? updated : s);
                    this.showSuccess('Categorías asignadas');
                },
                error: () => this.showError('Error al asignar categorías'),
            });
        });
    }

    getCategoryNames(categoryIds: number[]) {
        return categoryIds.map(id => this.categories().find(c => c.id === id)?.name ?? id).join(', ');
    }

    private showSuccess(msg: string) { this.snackBar.open(msg, 'Cerrar', { duration: 3000 }); }
    private showError(msg: string) { this.snackBar.open(msg, 'Cerrar', { duration: 3000, panelClass: 'error-snack' }); }
}

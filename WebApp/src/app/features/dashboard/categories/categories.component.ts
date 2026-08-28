import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { Validators } from '@angular/forms';
import { CategoriesService } from './categories.service';
import { CategoryResponse } from '../../../shared/models/category.model';
import { DialogConfig, GenericFormDialogComponent } from '../../../shared/components/dialogs/generic-form-dialog/generic-form-dialog.component';
import { CustomizerSettingsService } from '../../../shared/components/customizer-settings/customizer-settings.service';

@Component({
    selector: 'app-categories',
    imports: [MatTableModule, MatPaginatorModule, MatButtonModule, MatIconModule, MatDialogModule, MatSnackBarModule, MatCardModule],
    templateUrl: './categories.component.html',
    styleUrl: './categories.component.scss'
})
export class CategoriesComponent implements OnInit, AfterViewInit {

    @ViewChild(MatPaginator) paginator!: MatPaginator;

    displayedColumns = ['id', 'name', 'actions'];
    dataSource = new MatTableDataSource<CategoryResponse>([]);

    constructor(
        private categoriesService: CategoriesService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar,
        public themeService: CustomizerSettingsService
    ) {}

    ngOnInit() { this.loadCategories(); }

    ngAfterViewInit() { this.dataSource.paginator = this.paginator; }

    loadCategories() {
        this.categoriesService.getAll().subscribe({
            next: data => this.dataSource.data = data,
            error: () => this.showError('Error loading categories')
        });
    }

    openForm(category?: CategoryResponse) {
        const config: DialogConfig = {
            title: 'Category',
            fields: [{ key: 'name', label: 'Name', type: 'text', validators: [Validators.required, Validators.maxLength(100)] }],
            data: category ?? null
        };

        const dialogRef = this.dialog.open(GenericFormDialogComponent, {
            width: '400px', data: config,
            panelClass: this.themeService.isDark() ? 'dark-theme' : ''
        });

        dialogRef.afterClosed().subscribe(result => {
            if (!result) return;
            if (category) {
                this.categoriesService.update(category.id, result.data).subscribe({
                    next: updated => {
                        this.dataSource.data = this.dataSource.data.map(c => c.id === updated.id ? updated : c);
                        this.showSuccess('Category updated');
                    },
                    error: () => this.showError('Error updating category')
                });
            } else {
                this.categoriesService.create(result.data).subscribe({
                    next: created => {
                        this.dataSource.data = [...this.dataSource.data, created];
                        this.showSuccess('Category created');
                    },
                    error: () => this.showError('Error creating category')
                });
            }
        });
    }

    delete(id: number) {
        this.categoriesService.delete(id).subscribe({
            next: () => {
                this.dataSource.data = this.dataSource.data.filter(c => c.id !== id);
                this.showSuccess('Category deleted');
            },
            error: () => this.showError('Error deleting category')
        });
    }

    private showSuccess(msg: string) { this.snackBar.open(msg, 'Close', { duration: 3000 }); }
    private showError(msg: string) { this.snackBar.open(msg, 'Close', { duration: 3000, panelClass: 'error-snack' }); }
}

import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { Validators } from '@angular/forms';
import { RolesService } from './roles.service';
import { MenuService } from '../../../core/services/menu.service';
import { RolResponse } from '../../../shared/models/rol.model';
import { MenuResponse } from '../../../shared/models/menu.model';
import { DialogConfig, GenericFormDialogComponent } from '../../../shared/components/dialogs/generic-form-dialog/generic-form-dialog.component';
import { CustomizerSettingsService } from '../../../shared/components/customizer-settings/customizer-settings.service';
import { signal } from '@angular/core';

@Component({
    selector: 'app-roles',
    imports: [MatTableModule, MatPaginatorModule, MatButtonModule, MatIconModule, MatDialogModule, MatSnackBarModule, MatCardModule],
    templateUrl: './roles.component.html',
    styleUrl: './roles.component.scss',
})
export class RolesComponent implements OnInit, AfterViewInit {

    @ViewChild(MatPaginator) paginator!: MatPaginator;

    displayedColumns = ['id', 'name', 'description', 'actions'];
    dataSource = new MatTableDataSource<RolResponse>([]);
    allMenus = signal<MenuResponse[]>([]);

    constructor(
        private rolesService: RolesService,
        private menuService: MenuService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar,
        public themeService: CustomizerSettingsService,
    ) {}

    ngOnInit() {
        this.rolesService.getAll().subscribe({
            next: data => this.dataSource.data = data,
            error: () => this.showError('Error loading roles'),
        });
        this.menuService.getAllMenus().subscribe({
            next: data => this.allMenus.set(data.filter(m => m.parentId !== null)),
            error: () => this.showError('Error loading menus'),
        });
    }

    ngAfterViewInit() { this.dataSource.paginator = this.paginator; }

    openForm(rol?: RolResponse) {
        const config: DialogConfig = {
            title: 'Role',
            fields: [
                { key: 'name', label: 'Name', type: 'text', validators: [Validators.required, Validators.maxLength(100)] },
                { key: 'description', label: 'Description', type: 'textarea' },
                { key: 'menuIds', label: 'Menus', type: 'multiselect', options: this.allMenus().map(m => ({ value: m.id, label: m.name })) },
            ],
            data: rol ?? null,
        };

        const dialogRef = this.dialog.open(GenericFormDialogComponent, {
            width: '500px', data: config,
            panelClass: this.themeService.isDark() ? 'dark-theme' : '',
        });

        dialogRef.afterClosed().subscribe(result => {
            if (!result) return;
            if (rol) {
                this.rolesService.update(rol.id, result.data).subscribe({
                    next: updated => {
                        this.dataSource.data = this.dataSource.data.map(r => r.id === updated.id ? updated : r);
                        this.showSuccess('Role updated');
                    },
                    error: () => this.showError('Error updating role'),
                });
            } else {
                this.rolesService.create(result.data).subscribe({
                    next: created => {
                        this.dataSource.data = [...this.dataSource.data, created];
                        this.showSuccess('Role created');
                    },
                    error: () => this.showError('Error creating role'),
                });
            }
        });
    }

    delete(id: number) {
        this.rolesService.delete(id).subscribe({
            next: () => {
                this.dataSource.data = this.dataSource.data.filter(r => r.id !== id);
                this.showSuccess('Role deleted');
            },
            error: () => this.showError('Error deleting role'),
        });
    }

    private showSuccess(msg: string) { this.snackBar.open(msg, 'Close', { duration: 3000 }); }
    private showError(msg: string) { this.snackBar.open(msg, 'Close', { duration: 3000, panelClass: 'error-snack' }); }
}

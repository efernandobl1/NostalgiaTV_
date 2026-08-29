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
            error: () => this.showError('Error al cargar los roles'),
        });
        this.menuService.getAllMenus().subscribe({
            next: data => this.allMenus.set(data),
            error: () => this.showError('Error al cargar los menús'),
        });
    }

    ngAfterViewInit() { this.dataSource.paginator = this.paginator; }

    // Agrupa los menús hijos bajo su sección padre (SEGURIDAD, CONTENIDO, ...)
    // para que el selector sea legible en vez de una lista plana.
    private buildMenuGroups() {
        const menus = this.allMenus();
        return menus
            .filter(m => m.parentId === null)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map(parent => ({
                // caption es la etiqueta en español que ya usa el sidebar (name está en inglés).
                label: parent.caption || parent.name,
                options: menus
                    .filter(m => m.parentId === parent.id)
                    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                    .map(child => ({ value: child.id, label: child.caption || child.name })),
            }))
            .filter(g => g.options.length > 0);
    }

    openForm(rol?: RolResponse) {
        const config: DialogConfig = {
            title: 'rol',
            fields: [
                { key: 'name', label: 'Nombre', type: 'text', validators: [Validators.required, Validators.maxLength(100)] },
                { key: 'description', label: 'Descripción', type: 'textarea' },
                { key: 'menuIds', label: 'Menús a los que puede acceder', type: 'checkboxes', groups: this.buildMenuGroups() },
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
                        this.showSuccess('Rol actualizado');
                    },
                    error: () => this.showError('Error al actualizar el rol'),
                });
            } else {
                this.rolesService.create(result.data).subscribe({
                    next: created => {
                        this.dataSource.data = [...this.dataSource.data, created];
                        this.showSuccess('Rol creado');
                    },
                    error: () => this.showError('Error al crear el rol'),
                });
            }
        });
    }

    delete(id: number) {
        this.rolesService.delete(id).subscribe({
            next: () => {
                this.dataSource.data = this.dataSource.data.filter(r => r.id !== id);
                this.showSuccess('Rol eliminado');
            },
            error: () => this.showError('Error al eliminar el rol'),
        });
    }

    private showSuccess(msg: string) { this.snackBar.open(msg, 'Cerrar', { duration: 3000 }); }
    private showError(msg: string) { this.snackBar.open(msg, 'Cerrar', { duration: 3000, panelClass: 'error-snack' }); }
}

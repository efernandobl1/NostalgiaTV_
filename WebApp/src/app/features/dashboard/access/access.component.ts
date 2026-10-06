import { Component, computed, effect, inject, signal } from '@angular/core';
import { MenuService } from '../../../core/services/menu.service';
import { UsersComponent } from '../users/users.component';
import { RolesComponent } from '../roles/roles.component';

@Component({
  selector: 'app-access',
  standalone: true,
  imports: [UsersComponent, RolesComponent],
  template: `
    <section class="access-page">
      <header class="studio-heading">
        <div>
          <h1>Accesos al estudio</h1>
          <p>Define quién puede trabajar en el panel y qué herramientas tiene disponibles.</p>
        </div>
      </header>
      <nav class="studio-tabs" aria-label="Usuarios y roles">
        @if (canViewUsers()) {
          <button type="button" [attr.aria-pressed]="tab() === 'users'" (click)="tab.set('users')">
            Usuarios
          </button>
        }
        @if (canViewRoles()) {
          <button type="button" [attr.aria-pressed]="tab() === 'roles'" (click)="tab.set('roles')">
            Roles y permisos
          </button>
        }
      </nav>
      @if (tab() === 'users' && canViewUsers()) {
        <app-users />
      }
      @if (tab() === 'roles' && canViewRoles()) {
        <app-roles />
      }
    </section>
  `,
  styles: `
    @use '../../../../styles/dashboard-components';
    .access-page {
      display: grid;
      gap: 26px;
    }
  `,
})
export class AccessComponent {
  private readonly menuService = inject(MenuService);
  readonly canViewUsers = computed(() => this.hasAccess('/dashboard/users'));
  readonly canViewRoles = computed(() => this.hasAccess('/dashboard/roles'));
  readonly tab = signal<'users' | 'roles'>('users');
  constructor() {
    effect(() => {
      if (!this.canViewUsers() && this.canViewRoles()) this.tab.set('roles');
      else if (!this.canViewRoles()) this.tab.set('users');
    });
  }
  private hasAccess(url: string): boolean {
    const flatten = (menus: ReturnType<MenuService['menus']>): string[] =>
      menus.flatMap((menu) => [menu.url, ...flatten(menu.children ?? [])]);
    return flatten(this.menuService.menus()).includes(url);
  }
}

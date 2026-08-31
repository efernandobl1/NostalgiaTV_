import { Component, signal } from '@angular/core';
import { UsersComponent } from '../users/users.component';
import { RolesComponent } from '../roles/roles.component';

@Component({
  selector: 'app-access',
  standalone: true,
  imports: [UsersComponent, RolesComponent],
  template: `
    <section class="access-page">
      <div class="access-tabs" role="tablist" aria-label="Usuarios y roles">
        <button type="button" role="tab" [attr.aria-selected]="tab() === 'users'" [class.is-active]="tab() === 'users'" (click)="tab.set('users')">Usuarios</button>
        <button type="button" role="tab" [attr.aria-selected]="tab() === 'roles'" [class.is-active]="tab() === 'roles'" (click)="tab.set('roles')">Roles y permisos</button>
      </div>
      @if (tab() === 'users') { <app-users /> } @else { <app-roles /> }
    </section>
  `,
  styles: `
    .access-page { display:flex; flex-direction:column; gap:16px; }
    .access-tabs { display:flex; gap:8px; border-bottom:1px solid rgba(139,125,255,.18); }
    .access-tabs button { min-height:48px; padding:0 16px; border:0; border-bottom:2px solid transparent; color:var(--dashboard-muted); background:transparent; font:400 .9375rem/1 Outfit,sans-serif; }
    .access-tabs button.is-active { border-bottom-color:var(--dashboard-green); color:var(--dashboard-green); }
  `,
})
export class AccessComponent {
  readonly tab = signal<'users' | 'roles'>('users');
}

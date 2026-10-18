import { Component, computed, inject, input, output, signal } from '@angular/core';
import { AdminApi } from '../../../core/api/admin-api';
import { errorMessage } from '../../../core/api/api';
import { RoleListItem, UserListItem } from '../../../core/api/models';
import { passwordValid } from '../../auth/password';
import { Dialog } from '../../../shared/ui/dialog';

const USERNAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,49}$/;

/** Design: "Diálogo · Usuario" (create / edit). */
@Component({
  selector: 'app-user-dialog',
  imports: [Dialog],
  template: `
    <app-dialog eyebrow="ACCESO · USUARIO" [heading]="user() ? 'Editar usuario' : 'Nuevo usuario'" (closed)="closed.emit()">
      <div class="grid grid-cols-2 gap-2.5">
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Usuario
          <input class="field" type="text" maxlength="50" autocomplete="off" [value]="username()" (input)="username.set($any($event.target).value)">
        </label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Rol
          <select class="field field-select" (change)="roleId.set(+$any($event.target).value)">
            @for (r of roles(); track r.id) { <option [value]="r.id" [selected]="r.id === roleId()">{{ r.name }}</option> }
          </select>
        </label>
      </div>
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">{{ user() ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña' }}
        <input class="field" type="password" autocomplete="new-password" maxlength="128" placeholder="Mínimo 12 caracteres" (input)="password.set($any($event.target).value)">
      </label>
      @if (user(); as u) {
        <div class="flex flex-col gap-2 p-3 rounded-lg bg-raised">
          <span class="font-mono text-[11px] tracking-[0.1em] text-muted">SEGURIDAD</span>
          <div class="flex flex-wrap items-center justify-between gap-2.5 text-[14px]">
            <span><span [class]="u.failedLoginAttempts ? 'text-amber' : 'text-muted'">{{ u.failedLoginAttempts }} intentos fallidos</span> · {{ locked() ? 'bloqueado hasta ' + locked() : 'sin bloqueo activo' }}</span>
            <button class="btn btn-ghost btn-xs" type="button" [disabled]="!u.failedLoginAttempts && !locked()" (click)="run(admin.unlockUser(u.id), 'Intentos reiniciados.')">Reiniciar intentos</button>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-2.5 text-[14px]">
            <span>{{ u.activeSessions }} {{ u.activeSessions === 1 ? 'sesión activa' : 'sesiones activas' }}</span>
            <button class="btn btn-ghost btn-xs text-danger hover:text-danger" type="button" [disabled]="!u.activeSessions" (click)="run(admin.revokeUserSessions(u.id), 'Sesiones cerradas.')">Cerrar todas</button>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <span class="font-mono text-[11px] tracking-[0.1em] text-muted">INICIOS DE SESIÓN EXTERNOS</span>
          @for (p of u.externalLogins; track p) {
            <div class="flex items-center gap-2.5 min-h-11 px-3 border border-line rounded-md text-[14px]">
              <span class="flex-1">{{ p === 'google' ? 'Google' : p }} · vinculado</span>
              <button class="btn btn-xs bg-transparent text-danger" type="button" (click)="run(admin.unlinkUserLogin(u.id, p), 'Inicio externo desvinculado.')">Desvincular</button>
            </div>
          } @empty {
            <span class="text-[13px] text-muted">Ninguno.</span>
          }
        </div>
      }
      @if (notice()) { <span class="text-[13px] text-ok" role="status">{{ notice() }}</span> }
      @if (error()) { <span class="text-[13px] text-danger" role="alert">{{ error() }}</span> }
      <ng-container footer>
        @if (user()) {
          <button class="btn btn-danger-text" type="button" (click)="confirmDeactivate() ? deactivate() : confirmDeactivate.set(true)">{{ confirmDeactivate() ? 'Confirmar: desactivar' : 'Desactivar usuario' }}</button>
        }
        <span class="flex-1"></span>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" [disabled]="busy()" (click)="save()">{{ user() ? 'Guardar cambios' : 'Crear usuario' }}</button>
      </ng-container>
    </app-dialog>
  `,
})
export class UserDialog {
  protected readonly admin = inject(AdminApi);
  /** Null creates a new user. */
  readonly user = input<UserListItem | null>(null);
  readonly roles = input<RoleListItem[]>([]);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly username = signal('');
  readonly password = signal('');
  readonly roleId = signal(0);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly confirmDeactivate = signal(false);
  readonly locked = computed(() => {
    const until = this.user()?.lockedUntilUtc;
    return until && new Date(until).getTime() > Date.now() ? new Date(until).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '';
  });

  ngOnInit(): void {
    const u = this.user();
    this.username.set(u?.username ?? '');
    this.roleId.set(u?.roleId ?? this.roles().find(r => r.isViewerRole)?.id ?? this.roles()[0]?.id ?? 0);
  }

  async run(action: Promise<unknown>, message: string): Promise<void> {
    try {
      await action;
      this.notice.set(message);
      this.saved.emit();
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }

  async save(): Promise<void> {
    const name = this.username().trim(), password = this.password();
    if (!USERNAME.test(name)) { this.error.set('El usuario tiene 3–50 caracteres: letras, números, punto, guion o guion bajo.'); return; }
    if ((!this.user() || password) && !passwordValid(password)) { this.error.set('La contraseña necesita entre 12 y 128 caracteres.'); return; }
    this.busy.set(true);
    try {
      const u = this.user();
      if (u) await this.admin.updateUser(u.id, name, password || null, this.roleId());
      else await this.admin.createUser(name, password, this.roleId());
      this.saved.emit();
      this.closed.emit();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo guardar el usuario.'));
    } finally {
      this.busy.set(false);
    }
  }

  async deactivate(): Promise<void> {
    const u = this.user();
    if (!u) return;
    try {
      await this.admin.deactivateUser(u.id);
      this.saved.emit();
      this.closed.emit();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo desactivar el usuario.'));
    }
  }
}

/** Design: "Diálogo · Rol" (create / edit). */
@Component({
  selector: 'app-role-dialog',
  imports: [Dialog],
  template: `
    <app-dialog eyebrow="ACCESO · ROL" [heading]="role() ? 'Editar rol' : 'Nuevo rol'" (closed)="closed.emit()">
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Nombre
        <input class="field" type="text" maxlength="100" [value]="name()" (input)="name.set($any($event.target).value)">
      </label>
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Descripción
        <textarea class="field field-area" rows="2" maxlength="4000" [value]="description()" (input)="description.set($any($event.target).value)"></textarea>
      </label>
      <span class="text-[12px] text-muted">Los menús se asignan desde la pestaña Roles y menús.</span>
      @if (error()) { <span class="text-[13px] text-danger" role="alert">{{ error() }}</span> }
      <ng-container footer>
        @if (role(); as r) {
          @if (!r.isAdministrator && !r.isViewerRole) {
            <button class="btn btn-danger-text" type="button" (click)="confirmDelete() ? remove() : confirmDelete.set(true)">{{ confirmDelete() ? 'Confirmar: eliminar' : 'Eliminar rol' }}</button>
          }
        }
        <span class="flex-1"></span>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" [disabled]="!name().trim()" (click)="save()">Guardar</button>
      </ng-container>
    </app-dialog>
  `,
})
export class RoleDialog {
  private readonly admin = inject(AdminApi);
  readonly role = input<RoleListItem | null>(null);
  readonly closed = output<void>();
  readonly saved = output<number | null>();
  readonly name = signal('');
  readonly description = signal('');
  readonly error = signal('');
  readonly confirmDelete = signal(false);

  ngOnInit(): void {
    this.name.set(this.role()?.name ?? '');
    this.description.set(this.role()?.description ?? '');
  }

  async save(): Promise<void> {
    try {
      const r = this.role();
      const result = r ? await this.admin.updateRole(r.id, this.name().trim(), this.description().trim() || null) : await this.admin.createRole(this.name().trim(), this.description().trim() || null);
      this.saved.emit(result.id);
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo guardar el rol.'));
    }
  }

  async remove(): Promise<void> {
    const r = this.role();
    if (!r) return;
    try {
      await this.admin.deleteRole(r.id);
      this.saved.emit(null);
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo eliminar el rol.'));
    }
  }
}

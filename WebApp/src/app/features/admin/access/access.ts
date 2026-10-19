import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { AdminApi } from '../../../core/api/admin-api';
import { errorMessage } from '../../../core/api/api';
import { ActivityItem, MenuItem, RoleListItem, UserListItem } from '../../../core/api/models';
import { Session } from '../../../core/session';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { PageHeader } from '../../../shared/ui/page-header';
import { RoleDialog, UserDialog } from './access-dialogs';

const OK = '#8BE08F', WARN = '#FFB547', BAD = '#FF8A80';

@Component({
  selector: 'app-access',
  imports: [PageHeader, ConfirmDialog, UserDialog, RoleDialog],
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './access.html',
})
export class Access {
  private readonly admin = inject(AdminApi);
  private readonly session = inject(Session);
  readonly tabs = ['Usuarios', 'Roles y menús', 'Registro de actividad'];
  readonly tab = signal(0);
  readonly roleIndex = signal(0);
  readonly dlg = signal<'user' | 'role' | 'revoke' | null>(null);
  readonly mode = signal<'create' | 'edit'>('edit');
  readonly error = signal('');
  readonly notice = signal('');

  readonly rawUsers = signal<UserListItem[]>([]);
  readonly rawRoles = signal<RoleListItem[]>([]);
  readonly allMenus = signal<MenuItem[]>([]);
  readonly activity = signal<ActivityItem[]>([]);
  readonly editingUser = signal<UserListItem | null>(null);
  readonly target = signal<UserListItem | null>(null);

  readonly users = computed(() => this.rawUsers().map(u => {
    const locked = u.lockedUntilUtc && new Date(u.lockedUntilUtc).getTime() > Date.now();
    return {
      id: u.id, name: u.username, role: u.role, ext: u.externalLogins.map(p => (p === 'google' ? 'Google' : p)).join(', ') || '—', item: u,
      status: locked ? `Bloqueado hasta ${new Date(u.lockedUntilUtc!).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}` : u.failedLoginAttempts ? `${u.failedLoginAttempts} intentos fallidos` : 'Activo',
      stColor: locked ? BAD : u.failedLoginAttempts ? WARN : OK,
      sessions: u.activeSessions ? `${u.activeSessions} ${u.activeSessions === 1 ? 'activa' : 'activas'}` : '0',
    };
  }));
  readonly roles = computed(() => this.rawRoles().map(r => ({ id: r.id, name: r.name, desc: r.description || `${r.userCount} usuarios`, viewer: r.isViewerRole, item: r })));
  readonly role = computed(() => this.roles().at(this.roleIndex()) ?? null);

  /** Menu ids checked for the selected role (edited locally until saved). */
  readonly checked = signal(new Set<number>());
  readonly menus = computed(() => {
    const all = this.allMenus();
    const roots = all.filter(m => !m.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
    return roots.flatMap(root => [root, ...all.filter(m => m.parentId === root.id).sort((a, b) => a.sortOrder - b.sortOrder)])
      .map(m => ({ id: m.id, caption: m.caption, url: m.url, depth: m.parentId ? 1 : 0, on: this.checked().has(m.id) }));
  });

  readonly log = computed(() => this.activity().map(a => ({
    id: a.id, at: new Date(a.createdAtUtc).toISOString().slice(0, 16).replace('T', ' '), user: a.user, action: a.action, resource: a.resource, desc: a.description,
  })));

  constructor() {
    this.loadAll();
    effect(() => {
      const r = this.role();
      untracked(() => this.checked.set(new Set(r?.item.menuIds ?? [])));
    });
    effect(() => {
      if (this.tab() === 2) untracked(() => this.admin.activity(30, 1, 100).then(p => this.activity.set(p.items)).catch(error => this.error.set(errorMessage(error))));
    });
  }

  async loadAll(): Promise<void> {
    try {
      const [users, roles, menus] = await Promise.all([this.admin.users(), this.admin.roles(), this.admin.menus()]);
      this.rawUsers.set(users);
      this.rawRoles.set(roles);
      this.allMenus.set(menus);
      if (this.roleIndex() >= roles.length) this.roleIndex.set(0);
      this.error.set('');
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo cargar el acceso.'));
    }
  }

  open(dlg: 'user' | 'role', mode: 'create' | 'edit', user: UserListItem | null = null): void {
    this.mode.set(mode);
    this.editingUser.set(user);
    this.dlg.set(dlg);
  }

  revoke(user: UserListItem): void { this.target.set(user); this.dlg.set('revoke'); }

  async confirmRevoke(): Promise<void> {
    const u = this.target();
    if (!u) return;
    try {
      await this.admin.revokeUserSessions(u.id);
      this.notice.set(`Sesiones de ${u.username} cerradas.`);
      await this.loadAll();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudieron cerrar las sesiones.'));
    }
  }

  toggleMenu(id: number): void {
    this.checked.update(s => {
      const next = new Set(s);
      const children = this.allMenus().filter(m => m.parentId === id).map(m => m.id);
      if (next.has(id)) { next.delete(id); children.forEach(c => next.delete(c)); }
      else {
        next.add(id);
        children.forEach(c => next.add(c));
        const parent = this.allMenus().find(m => m.id === id)?.parentId;
        if (parent) next.add(parent);
      }
      return next;
    });
  }

  async saveMenus(): Promise<void> {
    const r = this.role();
    if (!r) return;
    try {
      await this.admin.setRoleMenus(r.id, [...this.checked()]);
      this.notice.set(`Permisos de ${r.name} guardados.`);
      await this.loadAll();
      // The signed-in admin may have changed their own role.
      await this.session.reloadMe();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudieron guardar los permisos.'));
    }
  }

  async roleSaved(id: number | null): Promise<void> {
    this.dlg.set(null);
    await this.loadAll();
    if (id) this.roleIndex.set(Math.max(0, this.rawRoles().findIndex(r => r.id === id)));
    else this.roleIndex.set(0);
  }
}

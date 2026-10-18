import { Component, computed, signal } from '@angular/core';
import { PageHeader } from '../../../shared/ui/page-header';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { RoleDialog, UserDialog } from './access-dialogs';

const OK = '#8BE08F', WARN = '#FFB547', BAD = '#FF8A80';
/** [caption, url, depth, enabled per role (admin, editor, viewer)] */
const MENUS: [string, string, number, number[]][] = [
  ['Operación', '', 0, [1, 1, 0]], ['Resumen', '/dashboard', 1, [1, 1, 0]], ['Programación', '/dashboard/schedule', 1, [1, 1, 0]], ['Canales y eras', '/dashboard/channels', 1, [1, 1, 0]],
  ['Catálogo', '', 0, [1, 1, 0]], ['Series y episodios', '/dashboard/series', 1, [1, 1, 0]], ['Interludios', '/dashboard/interludes', 1, [1, 1, 0]],
  ['Audiencia', '', 0, [1, 0, 0]], ['Comentarios', '/dashboard/comments', 1, [1, 1, 0]],
  ['Sistema', '', 0, [1, 0, 0]], ['Acceso', '/dashboard/access', 1, [1, 0, 0]], ['Ajustes', '/dashboard/settings', 1, [1, 0, 0]],
];

@Component({
  selector: 'app-access',
  imports: [PageHeader, ConfirmDialog, UserDialog, RoleDialog],
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './access.html',
})
export class Access {
  readonly tabs = ['Usuarios', 'Roles y menús', 'Registro de actividad'];
  readonly tab = signal(0);
  readonly roleIndex = signal(0);
  readonly dlg = signal<'user' | 'role' | 'revoke' | null>(null);
  readonly mode = signal<'create' | 'edit'>('edit');
  readonly target = signal('');

  readonly users = [
    { name: 'admin', role: 'Administrador', ext: '—', status: 'Activo', stColor: OK, sessions: '2 activas' },
    { name: 'fernando', role: 'Administrador', ext: 'Google', status: 'Activo', stColor: OK, sessions: '3 activas' },
    { name: 'maria.g', role: 'Espectador', ext: 'Google', status: 'Activo', stColor: OK, sessions: '1 activa' },
    { name: 'editor01', role: 'Editor', ext: '—', status: '3 intentos fallidos', stColor: WARN, sessions: '0' },
    { name: 'jpablo', role: 'Espectador', ext: '—', status: 'Bloqueado hasta 15:10', stColor: BAD, sessions: '0' },
    { name: 'lucia', role: 'Espectador', ext: 'Google', status: 'Activo', stColor: OK, sessions: '1 activa' },
  ];
  readonly roles = [
    { name: 'Administrador', desc: 'Acceso completo al panel', viewer: false },
    { name: 'Editor', desc: 'Catálogo, canales y programación', viewer: false },
    { name: 'Espectador', desc: 'Rol asignado al registrarse', viewer: true },
  ];
  readonly role = computed(() => this.roles[this.roleIndex()]);
  readonly menus = computed(() => MENUS.map(([caption, url, depth, on]) => ({ caption, url, depth, on: !!on[this.roleIndex()] })));
  readonly log = [
    { at: '2026-10-17 20:28', user: 'admin', action: 'comment.approve', resource: 'comments/2231', desc: 'Aprobó 3 comentarios' },
    { at: '2026-10-17 20:10', user: 'fernando', action: 'channel.era.select', resource: 'channels/5', desc: 'Era activa: Época dorada' },
    { at: '2026-10-17 19:57', user: 'sistema', action: 'schedule.generate', resource: 'channels/23', desc: 'Programación regenerada' },
    { at: '2026-10-17 19:41', user: 'fernando', action: 'interlude.create', resource: 'interludes/88', desc: 'Subió bumper Ya viene' },
    { at: '2026-10-17 19:02', user: 'admin', action: 'metadata.import', resource: 'series/42', desc: 'TMDB · es-MX' },
    { at: '2026-10-17 18:40', user: 'sistema', action: 'tokens.cleanup', resource: 'refresh-tokens', desc: '37 tokens expirados eliminados' },
    { at: '2026-10-17 18:12', user: 'jpablo', action: 'auth.lockout', resource: 'users/14', desc: 'Bloqueado por intentos fallidos' },
  ];

  open(dlg: 'user' | 'role', mode: 'create' | 'edit'): void { this.mode.set(mode); this.dlg.set(dlg); }
  revoke(name: string): void { this.target.set(name); this.dlg.set('revoke'); }
}

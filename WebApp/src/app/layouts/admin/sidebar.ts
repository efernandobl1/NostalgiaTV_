import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LogoMark } from '../../shared/ui/logo-mark';

interface NavItem { ch: string; label: string; path: string; badge?: string; exact?: boolean }

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, LogoMark],
  template: `
    <nav aria-label="Navegación del dashboard" class="w-full h-full min-h-screen py-6 px-3.5 flex flex-col gap-6.5 bg-rail text-fg font-sans">
      <a routerLink="/admin" class="flex items-center gap-3 px-2 no-underline text-fg hover:text-fg">
        <app-logo-mark />
        <span class="flex flex-col gap-0.5">
          <span class="font-display font-bold text-[18px] tracking-[0.08em]">NOSTALGIA TV</span>
          <span class="font-mono text-[11px] tracking-[0.12em] text-muted">CONTROL MASTER</span>
        </span>
      </a>

      @for (g of groups; track g.label) {
        <div class="flex flex-col gap-0.5">
          <span class="px-2.5 pb-1.5 font-mono text-[11px] tracking-[0.14em] text-dim">{{ g.label }}</span>
          @for (it of g.items; track it.path) {
            <a [routerLink]="it.path" routerLinkActive="nav-on" [routerLinkActiveOptions]="{ exact: !!it.exact }"
               #rla="routerLinkActive" [attr.aria-current]="rla.isActive ? 'page' : null"
               class="group flex items-center gap-2 min-h-10 px-2.5 rounded-md no-underline text-[14px] text-fg-2 bg-transparent hover:bg-raised hover:text-fg [&.nav-on]:bg-amber [&.nav-on]:text-on-amber [&.nav-on]:font-semibold">
              <span class="w-7.5 font-mono text-[11px] text-dim group-[.nav-on]:text-on-amber">{{ it.ch }}</span>
              <span class="flex-1">{{ it.label }}</span>
              @if (it.badge) {
                <span class="min-w-5.5 py-0.5 px-1.5 rounded-[10px] text-center font-mono text-[11px] text-on-amber bg-amber group-[.nav-on]:bg-on-amber group-[.nav-on]:text-amber">{{ it.badge }}</span>
              }
            </a>
          }
        </div>
      }

      <div class="mt-auto flex items-center gap-2.5 p-3 border border-line rounded-[10px] bg-panel">
        <span aria-hidden="true" class="w-9 h-9 rounded-lg flex items-center justify-center font-display font-bold text-on-amber bg-amber">AD</span>
        <span class="flex-1 flex flex-col gap-0.5 min-w-0">
          <span class="text-[14px] font-semibold">admin</span>
          <span class="text-[12px] text-muted">Administrador</span>
        </span>
        <a routerLink="/sesion-cerrada" aria-label="Cerrar sesión" class="flex items-center justify-center w-11 h-11 text-muted hover:text-fg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="M16 17l5-5-5-5"></path><path d="M21 12H9"></path></svg>
        </a>
      </div>
    </nav>
  `,
})
export class Sidebar {
  readonly groups: { label: string; items: NavItem[] }[] = [
    { label: 'OPERACIÓN', items: [
      { ch: '01', label: 'Resumen', path: '/admin', exact: true },
      { ch: '02', label: 'Programación', path: '/admin/programacion' },
      { ch: '03', label: 'Canales y eras', path: '/admin/canales' },
    ] },
    { label: 'CATÁLOGO', items: [
      { ch: '04', label: 'Series y episodios', path: '/admin/series' },
      { ch: '05', label: 'Interludios', path: '/admin/interludios' },
    ] },
    { label: 'AUDIENCIA', items: [
      { ch: '06', label: 'Espectadores', path: '/admin/espectadores' },
      { ch: '07', label: 'Comentarios', path: '/admin/comentarios', badge: '12' },
    ] },
    { label: 'SISTEMA', items: [
      { ch: '08', label: 'Procesamiento', path: '/admin/media', badge: '3' },
      { ch: '09', label: 'Acceso', path: '/admin/acceso' },
      { ch: '10', label: 'Ajustes', path: '/admin/ajustes' },
    ] },
  ];
}

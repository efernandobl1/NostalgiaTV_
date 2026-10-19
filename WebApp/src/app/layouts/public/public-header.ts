import { Component, ElementRef, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Session } from '../../core/session';
import { LogoMark } from '../../shared/ui/logo-mark';
import { injectSection, PUBLIC_NAV } from './public-section';

/** Design: "Header público" (desktop, md+). */
@Component({
  selector: 'app-public-header',
  imports: [RouterLink, LogoMark],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'menu.set(false)',
  },
  template: `
    <header class="relative w-full min-h-20 py-3 px-10 flex flex-wrap items-center gap-y-3 gap-x-7 bg-ink border-b border-raised-2 text-fg font-sans">
      <a class="flex items-center gap-2.5 text-fg hover:text-fg no-underline" routerLink="/">
        <app-logo-mark [size]="32" [dots]="false" />
        <span class="font-display font-bold text-[18px] tracking-[0.08em]">NOSTALGIA TV</span>
      </a>
      <nav class="flex-[1_1_auto] flex flex-wrap gap-1" aria-label="Principal">
        @for (l of nav; track l.key) {
          <a [routerLink]="l.path" [attr.aria-current]="l.key === section() ? 'page' : 'false'"
             class="inline-flex items-center min-h-11 px-3.5 rounded-[22px] no-underline text-[15px] text-fg-2 hover:text-fg aria-[current=page]:text-amber aria-[current=page]:bg-amber-wash aria-[current=page]:font-semibold">{{ l.label }}</a>
        }
      </nav>
      <div class="flex items-center gap-2">
        <a class="w-11 h-11 flex items-center justify-center rounded-[22px] text-fg hover:text-fg hover:bg-raised" routerLink="/series" aria-label="Buscar series">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>
        </a>
        @if (session.signedIn()) {
          <button class="w-11 h-11 flex items-center justify-center border-0 rounded-full bg-amber text-on-amber font-display font-bold text-[14px] cursor-pointer" type="button"
                  (click)="menu.set(!menu())" [attr.aria-expanded]="menu()" aria-label="Menú de perfil">{{ session.initials() }}</button>
        } @else {
          <a class="inline-flex items-center min-h-11 px-4.5 border border-edge rounded-[22px] text-fg hover:text-fg text-[14px] font-medium no-underline" routerLink="/login">Iniciar sesión</a>
          <a class="inline-flex items-center min-h-11 px-4.5 rounded-[22px] bg-amber text-on-amber hover:text-on-amber text-[14px] font-semibold no-underline" routerLink="/registro">Crear cuenta</a>
        }
      </div>
      @if (menu() && session.signedIn()) {
        <div class="absolute top-18 right-10 z-20 w-60 flex flex-col p-2 border border-edge rounded-xl bg-panel shadow-[0_16px_40px_rgba(0,0,0,0.5)]" role="menu">
          <span class="py-2.5 px-3 text-[13px] text-muted">Sesión iniciada como <strong class="text-fg">{{ session.user() }}</strong></span>
          <a class="flex items-center min-h-11 px-3 rounded-lg text-fg hover:text-fg hover:bg-raised text-[14px] no-underline" role="menuitem" routerLink="/vincular" (click)="menu.set(false)">Mis dispositivos</a>
          <a class="flex items-center min-h-11 px-3 rounded-lg text-fg hover:text-fg hover:bg-raised text-[14px] no-underline" role="menuitem" routerLink="/perfil" (click)="menu.set(false)">Historial de visualización</a>
          @if (session.canUseDashboard()) {
            <a class="flex items-center min-h-11 px-3 rounded-lg text-fg hover:text-fg hover:bg-raised text-[14px] no-underline" role="menuitem" routerLink="/admin" (click)="menu.set(false)">Panel de control</a>
          }
          <button class="flex items-center min-h-11 px-3 border-0 rounded-lg bg-transparent text-danger hover:bg-raised text-[14px] text-left cursor-pointer" role="menuitem" type="button" (click)="signOut()">Cerrar sesión</button>
        </div>
      }
    </header>
  `,
})
export class PublicHeader {
  protected readonly session = inject(Session);
  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly nav = PUBLIC_NAV;
  protected readonly section = injectSection();
  protected readonly menu = signal(false);

  protected onDocumentClick(e: MouseEvent): void {
    if (this.menu() && !this.host.nativeElement.querySelector('header')?.contains(e.target as Node)) this.menu.set(false);
  }

  private readonly router = inject(Router);

  protected async signOut(): Promise<void> {
    this.menu.set(false);
    await this.session.signOut();
    this.router.navigateByUrl('/sesion-cerrada');
  }
}

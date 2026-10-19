import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LogoMark } from '../../shared/ui/logo-mark';

export type TvSection = 'channels' | 'guide' | 'series' | 'pair';

/** Top bar of the TV home and series screens: brand, section tabs and the clock. */
@Component({
  selector: 'app-tv-header',
  imports: [RouterLink, LogoMark],
  host: { '[class]': "full() ? 'relative flex items-center gap-12' : 'relative flex items-center gap-10'" },
  template: `
    <span class="flex items-center gap-3.5">
      @if (full()) { <app-logo-mark [size]="44" [dots]="false" /> }
      <span class="font-display font-bold text-[28px] tracking-[0.08em]">NOSTALGIA TV</span>
    </span>
    <nav class="flex" [class.gap-3]="full()" [class.gap-2]="!full()" aria-label="Secciones">
      @for (l of links; track l.key) {
        <a class="tv-focus py-3 rounded-[30px] text-[24px] no-underline text-muted hover:text-fg aria-[current=page]:bg-fg aria-[current=page]:text-ink-2 aria-[current=page]:font-semibold"
           [class]="full() ? 'px-7' : 'px-6.5'"[routerLink]="l.path" [attr.aria-current]="l.key === active() ? 'page' : null">{{ l.label }}</a>
      }
    </nav>
    <span class="flex-1"></span>
    @if (full()) {
      <a class="tv-focus w-14 h-14 flex items-center justify-center rounded-[28px] bg-[rgba(236,232,220,0.1)] text-fg hover:text-fg" routerLink="/tv/series" aria-label="Buscar">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>
      </a>
    }
    <span class="font-display font-semibold" [class]="full() ? 'text-[32px]' : 'text-[30px]'">14:32</span>
    @if (full()) {
      <a class="tv-focus w-14 h-14 rounded-full flex items-center justify-center font-display font-bold text-[22px] text-on-amber hover:text-on-amber bg-amber no-underline" routerLink="/tv/ajustes" aria-label="Perfil y ajustes">FE</a>
    }
  `,
})
export class TvHeader {
  readonly active = input<TvSection>('channels');
  /** Home variant: logo, search and avatar. */
  readonly full = input(true);
  readonly links: { key: TvSection; label: string; path: string }[] = [
    { key: 'channels', label: 'Canales', path: '/tv' },
    { key: 'guide', label: 'Guía', path: '/tv/guia' },
    { key: 'series', label: 'Series', path: '/tv/series' },
    { key: 'pair', label: 'Vincular', path: '/tv/vincular' },
  ];
}

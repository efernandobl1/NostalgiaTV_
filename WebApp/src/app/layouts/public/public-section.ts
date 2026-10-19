import { computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

export type PublicSection = 'channels' | 'guide' | 'series' | 'pair';

/** Primary public navigation, shared by the desktop header and the mobile tab bar. */
export const PUBLIC_NAV: { key: PublicSection; label: string; short: string; path: string }[] = [
  { key: 'channels', label: 'Canales', short: 'Canales', path: '/' },
  { key: 'guide', label: 'Guía', short: 'Guía', path: '/guia' },
  { key: 'series', label: 'Series', short: 'Series', path: '/series' },
  { key: 'pair', label: 'Vincular TV', short: 'Vincular', path: '/vincular' },
];

/** Which nav entry a URL belongs to (channel detail and player live under Canales, profile under Vincular). */
export function sectionOf(url: string): PublicSection {
  const path = url.split(/[?#]/)[0];
  if (path.startsWith('/guia')) return 'guide';
  if (path.startsWith('/series')) return 'series';
  if (path.startsWith('/vincular') || path.startsWith('/perfil')) return 'pair';
  return 'channels';
}

/** Reactive current section; call from an injection context. */
export function injectSection() {
  const router = inject(Router);
  const url = toSignal(
    router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => router.url)),
    { initialValue: router.url },
  );
  return computed(() => sectionOf(url()));
}

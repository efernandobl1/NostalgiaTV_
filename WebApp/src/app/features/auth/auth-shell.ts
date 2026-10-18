import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LogoMark } from '../../shared/ui/logo-mark';

/** Centered auth page (scanline background + logo link to login); the card is projected. */
@Component({
  selector: 'app-auth-shell',
  imports: [RouterLink, LogoMark],
  host: { class: 'min-h-dvh py-12 px-6 flex flex-col items-center justify-center gap-7 scan-ink [--scan:0.025] text-fg font-sans' },
  template: `
    <a class="flex items-center gap-2.5 text-fg hover:text-fg no-underline" routerLink="/login">
      <app-logo-mark [size]="32" [dots]="false" />
      <span class="font-display font-bold text-[18px] tracking-[0.08em]">NOSTALGIA TV</span>
    </a>
    <ng-content />
  `,
})
export class AuthShell {}

/** Left brand panel of the split login / register screens (desktop). */
@Component({
  selector: 'app-auth-brand',
  imports: [LogoMark],
  host: { class: 'flex-[1_1_520px] min-h-80 p-12 max-sm:p-6 flex flex-col justify-between gap-8 scan-rail [--scan:0.025] border-r border-raised-2' },
  template: `
    <div class="flex items-center gap-3">
      <app-logo-mark [size]="40" />
      <span class="font-display font-bold text-[20px] tracking-[0.08em]">NOSTALGIA TV</span>
    </div>
    <ng-content />
  `,
})
export class AuthBrand {}

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MobileTabbar } from './mobile-tabbar';
import { PublicHeader } from './public-header';

/**
 * Viewer site shell. Desktop (md+) gets the public header; phones get the bottom tab bar.
 * Each page renders its own desktop and mobile markup (the design has separate boards for both).
 */
@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, PublicHeader, MobileTabbar],
  host: { class: 'min-h-dvh flex flex-col bg-ink text-fg font-sans' },
  template: `
    <app-public-header class="hidden md:block" />
    <div class="flex-1 flex flex-col"><router-outlet /></div>
    <app-mobile-tabbar class="md:hidden sticky bottom-0 z-30" />
  `,
})
export class PublicLayout {}

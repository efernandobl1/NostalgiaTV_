import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { injectSection, PUBLIC_NAV } from './public-section';

/** Design: bottom tab bar of every mobile board (<md). */
@Component({
  selector: 'app-mobile-tabbar',
  imports: [RouterLink],
  template: `
    <nav class="flex border-t border-raised-2 bg-rail pb-[calc(8px+env(safe-area-inset-bottom,0px))]" aria-label="Principal">
      @for (t of nav; track t.key) {
        <a [routerLink]="t.path" [attr.aria-current]="t.key === section() ? 'page' : 'false'"
           class="group flex-1 min-h-15 flex flex-col items-center justify-center gap-1.5 text-[12px] no-underline text-muted hover:text-muted aria-[current=page]:text-amber aria-[current=page]:font-semibold">
          <span class="w-6 h-1 rounded-xs bg-transparent group-aria-[current=page]:bg-amber" aria-hidden="true"></span>
          {{ t.short }}
        </a>
      }
    </nav>
  `,
})
export class MobileTabbar {
  protected readonly nav = PUBLIC_NAV;
  protected readonly section = injectSection();
}

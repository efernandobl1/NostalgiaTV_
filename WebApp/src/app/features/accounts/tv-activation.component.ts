import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DevicesComponent } from '../dashboard/devices/devices.component';

@Component({
  imports: [RouterLink, DevicesComponent],
  template: '<main class="activation"><a routerLink="/">NostalgiaTV · Volver a la TV</a><app-devices [tvOnly]="true" /></main>',
  styles: `
    :host {
      --dashboard-bg: #17141f; --dashboard-surface: #262130; --dashboard-raised: #2b243c;
      --dashboard-text: #f3ecdc; --dashboard-muted: #c3b8cc; --dashboard-border: #62536f;
      --dashboard-control-border: #88769d; --dashboard-green: #b4dfa1;
      --dashboard-yellow: #eac17a; --dashboard-purple: #c1ade3;
      display: block; min-height: 100dvh; background: var(--dashboard-bg);
      color: var(--dashboard-text); color-scheme: dark; font: 16px/1.5 Outfit, sans-serif;
    }
    .activation { max-width: 760px; margin: auto; padding: 32px 20px; }
    a { display: inline-flex; align-items: center; min-height: 44px; color: var(--dashboard-yellow); margin-bottom: 28px; }
    a:focus-visible { outline: 2px solid var(--dashboard-yellow); outline-offset: 3px; }
  `,
})
export class TvActivationComponent {}

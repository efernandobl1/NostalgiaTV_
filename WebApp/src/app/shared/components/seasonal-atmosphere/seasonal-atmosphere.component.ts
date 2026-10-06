import { Component, inject } from '@angular/core';
import { SeasonalThemeService } from '../../../core/services/seasonal-theme.service';

@Component({
  selector: 'app-seasonal-atmosphere',
  template: `@if (theme.enabled() && theme.effects()) {
    <div class="seasonal-atmosphere" aria-hidden="true">
      <svg class="seasonal-web seasonal-web--left" viewBox="0 0 140 140"><path d="M0 0L140 0M0 0L0 140M0 0L110 110M0 0L135 55M0 0L55 135M0 30Q18 18 30 0M0 65Q35 30 65 0M0 105Q55 50 105 0M30 0Q30 23 23 23Q23 30 0 30M65 0Q60 50 46 46Q50 60 0 65M105 0Q97 85 74 74Q85 97 0 105"/></svg>
      <svg class="seasonal-web seasonal-web--right" viewBox="0 0 140 140"><path d="M0 0L140 0M0 0L0 140M0 0L110 110M0 0L135 55M0 0L55 135M0 30Q18 18 30 0M0 65Q35 30 65 0M0 105Q55 50 105 0"/></svg>
      @if (theme.effects()) { <svg class="seasonal-bat" viewBox="0 0 100 45"><path d="M50 15L45 5L41 16Q22 13 2 1Q5 24 22 35Q24 23 36 31Q41 26 50 43Q59 26 64 31Q76 23 78 35Q95 24 98 1Q78 13 59 16L55 5Z"/><circle cx="46" cy="21" r="1.5"/><circle cx="54" cy="21" r="1.5"/></svg> }
    </div>
  }`,
})
export class SeasonalAtmosphereComponent { readonly theme = inject(SeasonalThemeService); }

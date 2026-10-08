import { DOCUMENT } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { SeasonalThemeService } from '../../../core/services/seasonal-theme.service';

@Component({
  selector: 'app-seasonal-atmosphere',
  host: { '(document:visibilitychange)': 'updateVisibility()' },
  template: `@if (theme.enabled() && theme.effects()) {
    <div
      class="seasonal-atmosphere"
      [class.seasonal-atmosphere--paused]="hidden()"
      aria-hidden="true"
    >
      @for (spider of spiders; track spider) {
        <span class="seasonal-spider" [class]="'seasonal-spider seasonal-spider--' + spider">
          <span class="seasonal-spider__thread"></span>
          <svg viewBox="0 0 32 30" class="seasonal-spider__body">
            <path
              d="M12 12L6 7L3 1M11 15L4 13L1 9M11 18L4 20L2 26M12 20L8 25L8 29M20 12L26 7L29 1M21 15L28 13L31 9M21 18L28 20L30 26M20 20L24 25L24 29"
            />
            <ellipse cx="16" cy="16" rx="6" ry="8" />
            <circle cx="14" cy="13" r="1" />
            <circle cx="18" cy="13" r="1" />
          </svg>
        </span>
      }
      <svg class="seasonal-web seasonal-web--left" viewBox="0 0 140 140">
        <path
          d="M0 0L140 0M0 0L0 140M0 0L110 110M0 0L135 55M0 0L55 135M0 30Q18 18 30 0M0 65Q35 30 65 0M0 105Q55 50 105 0M30 0Q30 23 23 23Q23 30 0 30M65 0Q60 50 46 46Q50 60 0 65M105 0Q97 85 74 74Q85 97 0 105"
        />
      </svg>
      <svg class="seasonal-web seasonal-web--right" viewBox="0 0 140 140">
        <path
          d="M0 0L140 0M0 0L0 140M0 0L110 110M0 0L135 55M0 0L55 135M0 30Q18 18 30 0M0 65Q35 30 65 0M0 105Q55 50 105 0"
        />
      </svg>
      @for (bat of bats; track bat) {
        <svg class="seasonal-bat" [class.seasonal-bat--passing]="bat === 1" viewBox="0 0 100 45">
          <path
            d="M50 15L45 5L41 16Q22 13 2 1Q5 24 22 35Q24 23 36 31Q41 26 50 43Q59 26 64 31Q76 23 78 35Q95 24 98 1Q78 13 59 16L55 5Z"
          />
          <circle cx="46" cy="21" r="1.5" />
          <circle cx="54" cy="21" r="1.5" />
        </svg>
      }
      <svg class="seasonal-ghost" viewBox="0 0 40 48">
        <path d="M6 45V19a14 14 0 0 1 28 0v26l-7-5-7 5-7-5Z" />
        <ellipse cx="15" cy="20" rx="2" ry="3" />
        <ellipse cx="25" cy="20" rx="2" ry="3" />
        <ellipse cx="20" cy="30" rx="3" ry="4" />
      </svg>
      <svg class="seasonal-pumpkin" viewBox="0 0 48 42">
        <path class="seasonal-pumpkin__stem" d="M24 12q-3-6 3-10" />
        <path d="M24 12C1 3 0 38 18 39q6 2 12 0C48 38 47 3 24 12Z" />
        <path
          class="seasonal-pumpkin__face"
          d="m12 22 7-6 2 7Zm15 1 2-7 7 6ZM13 28l7 3 4-3 4 3 7-3-4 7H17Z"
        />
      </svg>
    </div>
  }`,
})
export class SeasonalAtmosphereComponent {
  readonly theme = inject(SeasonalThemeService);
  private readonly document = inject(DOCUMENT);
  readonly hidden = signal(this.document.hidden);
  readonly spiders = [1, 2, 3];
  readonly bats = [0, 1];
  updateVisibility(): void {
    this.hidden.set(this.document.hidden);
  }
}

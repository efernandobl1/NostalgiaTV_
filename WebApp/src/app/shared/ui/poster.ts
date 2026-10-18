import { Component, input } from '@angular/core';
import { ProgressBar } from './progress-bar';

/**
 * 2:3 series poster placeholder (scanlines + title at the bottom).
 * Padding and radius come from the host class; badges are projected.
 */
@Component({
  selector: 'app-poster',
  imports: [ProgressBar],
  host: { class: 'relative flex items-end aspect-[2/3] overflow-hidden border border-line scan-raised' },
  template: `
    <ng-content />
    <span class="font-display font-bold leading-[1.1]" [style.font-size.px]="titleSize()">{{ name() }}</span>
    @if (pct() !== null) {
      <app-progress-bar [pct]="pct()!" [height]="barHeight()" track="rgba(255,255,255,0.08)" />
    }
  `,
})
export class Poster {
  readonly name = input.required<string>();
  readonly titleSize = input(16);
  readonly pct = input<number | null>(null);
  readonly barHeight = input(3);
}

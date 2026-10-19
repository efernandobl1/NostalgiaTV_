import { Component, input } from '@angular/core';

/**
 * Amber watch-progress line pinned to the bottom of a thumbnail/screen
 * (the parent must be `relative`). Height and track color vary per board.
 */
@Component({
  selector: 'app-progress-bar',
  host: { class: 'absolute left-0 right-0 bottom-0 block', '[style.height.px]': 'height()', '[style.background]': 'track()' },
  template: `<span class="block h-full bg-amber" [style.width.%]="pct()"></span>`,
})
export class ProgressBar {
  readonly pct = input(0);
  readonly height = input(3);
  readonly track = input('rgba(255,255,255,0.12)');
}

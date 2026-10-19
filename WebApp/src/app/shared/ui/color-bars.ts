import { Component } from '@angular/core';

/** SMPTE-style test-pattern bars (login footer, 404 and TV screens). Size comes from the host class. */
@Component({
  selector: 'app-color-bars',
  host: { class: 'flex overflow-hidden', 'aria-hidden': 'true' },
  template: `
    @for (c of colors; track c) { <span class="flex-1" [style.background]="c"></span> }
  `,
})
export class ColorBars {
  readonly colors = ['#C9C6BC', '#D9C64A', '#4FC2C9', '#4FB255', '#B44FB0', '#C2463F', '#3F4FB8'];
}

import { Component, input } from '@angular/core';

/** Admin page heading: mono channel eyebrow, display title and right-aligned actions. */
@Component({
  selector: 'app-page-header',
  host: { class: 'flex flex-wrap items-end justify-between gap-4' },
  template: `
    <div class="flex flex-col gap-1.5">
      <span class="font-mono text-[12px] tracking-[0.14em] text-muted">{{ eyebrow() }}</span>
      <h1 class="m-0 font-display font-bold text-[36px]">{{ title() }}</h1>
      @if (subtitle()) { <span class="text-[14px] text-muted">{{ subtitle() }}</span> }
    </div>
    <div class="flex flex-wrap items-center gap-2.5"><ng-content /></div>
  `,
})
export class PageHeader {
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly subtitle = input('');
}

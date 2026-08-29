import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-dashboard-page-header',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="breadcrumb-card mb-[25px] md:flex md:items-center md:justify-between">
      <h5 class="m-0">{{ title() }}</h5>
      <ng-content />
    </div>
  `,
})
export class DashboardPageHeaderComponent {
  readonly title = input.required<string>();
}

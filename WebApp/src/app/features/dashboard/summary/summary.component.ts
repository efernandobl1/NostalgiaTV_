import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../dashboard.service';
import { DashboardSummaryResponse } from '../../../shared/models/dashboard.model';

@Component({
  selector: 'app-summary',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './summary.component.html',
  styleUrl: './summary.component.scss',
})
export class SummaryComponent {
  private readonly dashboardService = inject(DashboardService);
  readonly summary = signal<DashboardSummaryResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.dashboardService.getSummary().subscribe({
      next: summary => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  activityIcon(action: string): string {
    return action === 'delete' ? 'delete' : action === 'edit' ? 'edit' : 'upload';
  }
}

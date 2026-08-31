import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DashboardService } from '../dashboard.service';
import { ActivityResponse } from '../../../shared/models/dashboard.model';

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './activity.component.html',
  styleUrl: './activity.component.scss',
})
export class ActivityComponent {
  private readonly dashboardService = inject(DashboardService);
  readonly days = signal(7);
  readonly activity = signal<ActivityResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);

  constructor() {
    this.load(7);
  }

  load(days: number): void {
    this.days.set(days);
    this.loading.set(true);
    this.error.set(false);
    this.dashboardService.getActivity(days).subscribe({
      next: activity => {
        this.activity.set(activity);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  icon(action: string): string {
    return action === 'delete' ? 'delete' : action === 'edit' ? 'edit' : 'upload';
  }
}

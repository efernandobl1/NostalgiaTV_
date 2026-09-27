import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../dashboard.service';
import { ActivityResponse } from '../../../shared/models/dashboard.model';

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './activity.component.html',
  styleUrl: './activity.component.scss',
})
export class ActivityComponent {
  private readonly dashboardService = inject(DashboardService);
  readonly days = signal(7);
  readonly activity = signal<ActivityResponse[]>([]);
  readonly kind = signal<'all' | 'channel' | 'series'>('all');
  readonly visibleActivity = computed(() => this.activity().filter(entry => {
    const resource = entry.resource.toLowerCase();
    if (this.kind() === 'channel') return resource.includes('channel');
    if (this.kind() === 'series') return ['series', 'episodes', 'categories'].some(value => resource.includes(value));
    return true;
  }));
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

  resourceUrl(resource: string): string {
    const name = resource.toLowerCase();
    if (name.includes('channel')) return '/dashboard/channels';
    if (['series', 'episodes', 'categories'].some(value => name.includes(value))) return '/dashboard/series';
    if (name.includes('user') || name.includes('role')) return '/dashboard/users';
    return '/dashboard/summary';
  }
}

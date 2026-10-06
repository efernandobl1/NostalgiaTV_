import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, forkJoin, of } from 'rxjs';
import { DashboardService } from '../dashboard.service';
import { DashboardSummaryResponse } from '../../../shared/models/dashboard.model';
import { ChannelsService } from '../channels/channels.service';
import { SeriesService } from '../series/series.service';
import { ChannelResponse } from '../../../shared/models/channel.model';
import { SeriesResponse } from '../../../shared/models/serie.model';
import { environment } from '../../../../environments/environment';

interface ChannelStatePreview {
  episodeTitle?: string;
  seriesName?: string;
  nextEpisodeTitle?: string;
}

@Component({
  selector: 'app-summary',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './summary.component.html',
  styleUrl: './summary.component.scss',
})
export class SummaryComponent {
  readonly apiUrl = environment.apiUrl;
  private readonly dashboardService = inject(DashboardService);
  private readonly channelsService = inject(ChannelsService);
  private readonly seriesService = inject(SeriesService);
  private readonly http = inject(HttpClient);
  readonly summary = signal<DashboardSummaryResponse | null>(null);
  readonly channels = signal<ChannelResponse[]>([]);
  readonly series = signal<SeriesResponse[]>([]);
  readonly channelStates = signal<Record<number, ChannelStatePreview | null>>({});
  readonly channelsLoadFailed = signal(false);
  readonly seriesLoadFailed = signal(false);
  readonly loading = signal(true);
  readonly error = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.channelsLoadFailed.set(false);
    this.seriesLoadFailed.set(false);
    this.channelStates.set({});
    forkJoin({
      summary: this.dashboardService.getSummary(),
      channels: this.channelsService.getAll().pipe(
        catchError(() => {
          this.channelsLoadFailed.set(true);
          return of([] as ChannelResponse[]);
        }),
      ),
      series: this.seriesService.getAll().pipe(
        catchError(() => {
          this.seriesLoadFailed.set(true);
          return of([] as SeriesResponse[]);
        }),
      ),
    }).subscribe({
      next: ({ summary, channels, series }) => {
        this.summary.set(summary);
        this.channels.set(channels);
        this.series.set(series);
        this.loading.set(false);
        if (channels.length) {
          forkJoin(
            channels.map((channel) =>
              this.http
                .get<ChannelStatePreview>(
                  `${environment.apiUrl}/api/v1/public/channels/${channel.id}/state`,
                )
                .pipe(catchError(() => of(null))),
            ),
          ).subscribe((states) => {
            this.channelStates.set(
              Object.fromEntries(channels.map((channel, index) => [channel.id, states[index]])),
            );
          });
        }
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

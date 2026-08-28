import { Component, input, output, viewChild, signal, effect, computed, ElementRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TvSettings } from '../../../../core/services/tv-settings.service';
import { SeriesResponse } from '../../../models/serie.model';
import { ScheduleEntry } from '../../../models/channel-era.model';

interface Channel { id: number; name: string; logoPath?: string; }

@Component({
  selector: 'app-retro-tv-dialogs',
  standalone: true,
  imports: [CommonModule, DatePipe, MatButtonModule, MatIconModule],
  templateUrl: './retro-tv-dialogs.component.html',
  styleUrl: './retro-tv-dialogs.component.scss',
})
export class RetroTvDialogsComponent {
  // Series dialog
  showSeriesDialog = input<boolean>(false);
  allSeries = input<SeriesResponse[]>([]);
  seriesLoading = input<boolean>(false);
  seriesPage = input<number>(1);
  seriesTotalPages = input<number>(1);
  seriesSearchName = input<string>('');
  channels = input<Channel[]>([]);
  apiUrl = input<string>('');

  // Settings dialog
  showSettingsDialog = input<boolean>(false);
  settings = input.required<TvSettings>();

  // Schedule dialog
  showScheduleDialog = input<boolean>(false);
  scheduleEntries = input<ScheduleEntry[]>([]);
  scheduleLoading = input<boolean>(false);
  scheduleChannelId = input<number | null>(null);
  showBumpers = input<boolean>(false);

  filteredScheduleEntries = computed(() => {
    const entries = this.scheduleEntries();
    if (this.showBumpers()) return entries;
    return entries.filter(e => e.episodeId != null && e.episodeId > 0);
  });

  // View refs
  scheduleListRef = viewChild<ElementRef<HTMLDivElement>>('scheduleList');

  // Signals for external indicator
  currentEntryIndex = signal<number>(-1);
  currentEntryPosition = signal<number>(0);

  constructor() {
    effect(() => {
      const entries = this.filteredScheduleEntries();
      const now = new Date();
      let index = -1;
      let pos = 0;

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (new Date(entry.startTime) <= now && new Date(entry.endTime) > now) {
          index = i;
          // Calculate position relative to the dialog-wrapper
          // Header (70px) + Filters (60px) + Padding (24px) + item position
          const headerOffset = 154; // 70 + 60 + 24
          const itemHeight = 73;
          pos = headerOffset + (i * itemHeight);
          // Add progress within the current episode
          const progress = this.getCurrentProgress(entry);
          pos += (progress / 100) * itemHeight;
          break;
        }
      }
      this.currentEntryIndex.set(index);
      this.currentEntryPosition.set(pos);
    });
  }

  // Series dialog outputs
  closeSeriesDialog = output<void>();
  enterSeries = output<SeriesResponse>();
  searchChange = output<string>();
  channelFilterChange = output<string>();
  nextPage = output<void>();
  prevPage = output<void>();

  // Settings outputs
  closeSettingsDialog = output<void>();
  updateSetting = output<{ key: string; value: boolean | number }>();
  resetAll = output<void>();

  // Schedule outputs
  closeScheduleDialog = output<void>();
  scheduleChannelChange = output<number>();

  isCurrentEntry(entry: ScheduleEntry): boolean {
    const now = new Date();
    return new Date(entry.startTime) <= now && new Date(entry.endTime) > now;
  }

  getCurrentProgress(entry: ScheduleEntry): number {
    const now = new Date().getTime();
    const start = new Date(entry.startTime).getTime();
    const end = new Date(entry.endTime).getTime();
    if (now >= end) return 100;
    if (now <= start) return 0;
    return ((now - start) / (end - start)) * 100;
  }

  toLocalTime(utcString: string): Date {
      return new Date(utcString);
  }
}

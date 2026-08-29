import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SeriesResponse } from '../../../models/serie.model';
import { TvSettings } from '../../../../core/services/tv-settings.service';

interface EpisodeResponse {
  id: number; title: string; filePath?: string;
  season: number; episodeNumber: number;
  episodeTypeId: number; episodeTypeName: string; seriesId: number;
}

@Component({
  selector: 'app-retro-tv-remote-series',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './retro-tv-remote-series.component.html',
  styleUrl: './retro-tv-remote-series.component.scss',
})
export class RetroTvRemoteSeriesComponent {
  selectedSeries = input<SeriesResponse | null>(null);
  seasonGroups = input<number[]>([]);
  selectedSeason = input<number | null>(null);
  selectedEpisodeType = input<string>('normal');
  episodesForView = input<EpisodeResponse[]>([]);
  currentEpisodeId = input<number | null>(null);
  watchedMap = input<Record<number, boolean>>({});
  hasSpecials = input<boolean>(false);
  hasMovies = input<boolean>(false);
  isMuted = input<boolean>(false);
  settings = input.required<TvSettings>();
  apiUrl = input<string>('');

  selectSeason = output<number>();
  selectEpisodeType = output<string>();
  playEpisode = output<EpisodeResponse>();
  onRandomToggle = output<boolean>();
  resetSeries = output<void>();
  toggleMute = output<void>();
  volumeDown = output<void>();
  volumeUp = output<void>();
  toggleFullscreen = output<void>();
  openFilters = output<void>();
  backToChannels = output<void>();
  goToLogin = output<void>();
  openSettings = output<void>();
  changeSeries = output<void>();

  isCollapsed = signal<boolean>(true);
  toggleCollapse(): void { this.isCollapsed.update(v => !v); }
}

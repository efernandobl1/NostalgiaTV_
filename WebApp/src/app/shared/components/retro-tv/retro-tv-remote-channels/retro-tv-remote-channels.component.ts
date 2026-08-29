import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

interface Channel { id: number; name: string; logoPath?: string; }
interface ChannelEra { id: number; name: string; description?: string; seriesIds: number[]; }


@Component({
  selector: 'app-retro-tv-remote-channels',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './retro-tv-remote-channels.component.html',
  styleUrl: './retro-tv-remote-channels.component.scss',
})
export class RetroTvRemoteChannelsComponent {
  channels = input<Channel[]>([]);
  currentChannelId = input<number | null>(null);
  channelEras = input<ChannelEra[]>([]);
  selectedEraId = input<number | null>(null);
  isMuted = input<boolean>(false);
  hasChannel = input<boolean>(false);
  apiUrl = input<string>('');

  selectChannel = output<Channel>();
  selectEra = output<ChannelEra>();
  toggleMute = output<void>();
  volumeDown = output<void>();
  volumeUp = output<void>();
  toggleFullscreen = output<void>();
  openSeries = output<void>();
  openSchedule = output<void>();
  openFilters = output<void>();
  goToLogin = output<void>();
  openSettings = output<void>();

  isCollapsed = signal<boolean>(true);
  toggleCollapse(): void { this.isCollapsed.update(v => !v); }
}

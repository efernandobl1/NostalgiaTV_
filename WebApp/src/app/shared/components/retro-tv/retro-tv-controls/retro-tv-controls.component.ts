import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-retro-tv-controls',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './retro-tv-controls.component.html',
  styleUrl: './retro-tv-controls.component.scss',
})
export class RetroTvControlsComponent {
  visible = input<boolean>(false);
  isPaused = input<boolean>(false);
  isMuted = input<boolean>(false);
  volumeLevel = input<number>(1);
  progressPercent = input<number>(0);
  currentTimeFormatted = input<string>('0:00');
  durationFormatted = input<string>('0:00');
  audioTracks = input<any[]>([]);
  currentAudioTrack = input<number>(0);
  isFullscreen = input<boolean>(false);
  showProgress = input<boolean>(true);

  playPause = output<void>();
  toggleMute = output<void>();
  setVolume = output<number>();
  seek = output<MouseEvent>();
  progressKeydown = output<KeyboardEvent>();
  setAudioTrack = output<number>();
  toggleFullscreen = output<void>();

  getTrackLabel(track: any, index: number): string {
    const lang = (track?.language || track?.lang || '').toLowerCase();
    const label = track?.label || '';
    if (label) return label;
    if (lang) return lang.toUpperCase();
    return `Audio ${index + 1}`;
  }
}

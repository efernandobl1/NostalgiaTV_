import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'nostalgiatv-tv-mode';
const TV_USER_AGENT = /smart[- ]?tv|tizen|webos|web0s|hbbtv|netcast|viera|bravia|roku|aftb|aftm|aftt|crkey|ce-html|playstation|xbox/i;

@Injectable({ providedIn: 'root' })
export class TvModeService {
  readonly enabled = signal(this.readStoredPreference());
  readonly suggested = signal(TV_USER_AGENT.test(navigator.userAgent));

  setEnabled(enabled: boolean): void {
    this.enabled.set(enabled);
    localStorage.setItem(STORAGE_KEY, String(enabled));
  }

  toggle(): void {
    this.setEnabled(!this.enabled());
  }

  dismissSuggestion(): void {
    this.suggested.set(false);
  }

  private readStoredPreference(): boolean {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  }
}

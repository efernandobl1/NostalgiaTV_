import { computed, Injectable, signal } from '@angular/core';

/** Player preferences kept across the live page and fullscreen (mock; no real video yet). */
@Injectable({ providedIn: 'root' })
export class PlayerPrefs {
  readonly volume = signal(70);
  readonly muted = signal(false);
  readonly captions = signal(false);

  readonly muteLabel = computed(() => (this.muted() ? 'Activar sonido' : 'Silenciar'));
  /** Second path of the speaker icon: sound waves or an ✕. */
  readonly muteIcon = computed(() => (this.muted() ? 'M17 9l5 6M22 9l-5 6' : 'M17 8a5 5 0 0 1 0 8'));

  toggleMute(): void { this.muted.update(m => !m); }
  toggleCaptions(): void { this.captions.update(c => !c); }
  setVolume(v: number): void {
    this.volume.set(v);
    this.muted.set(v === 0);
  }
}

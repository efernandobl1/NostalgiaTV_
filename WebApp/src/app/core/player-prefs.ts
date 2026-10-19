import { computed, Injectable, signal } from '@angular/core';

/** CRT look laid over every video (scanlines, vignette, curved-tube shadow), as in the original NostalgiaTV. */
export interface CrtFilters {
  enabled: boolean;
  curvature: boolean;
  vignette: boolean;
  animated: boolean;
  /** Scanline darkness, 0–100 %. */
  intensity: number;
  /** Scanline spacing, 1–10. */
  density: number;
}

const CRT_KEY = 'ntv.crt';
const CRT_DEFAULTS: CrtFilters = { enabled: true, curvature: true, vignette: true, animated: false, intensity: 20, density: 2 };

function loadCrt(): CrtFilters {
  try {
    const saved = JSON.parse(localStorage.getItem(CRT_KEY) ?? 'null') as Partial<CrtFilters> | null;
    return saved && typeof saved === 'object' ? { ...CRT_DEFAULTS, ...saved } : { ...CRT_DEFAULTS };
  } catch {
    return { ...CRT_DEFAULTS };
  }
}

/** Player preferences (volume, mute, CRT filters) shared by every video screen. */
@Injectable({ providedIn: 'root' })
export class PlayerPrefs {
  readonly volume = signal(70);
  readonly muted = signal(false);
  readonly crt = signal<CrtFilters>(loadCrt());

  readonly muteLabel = computed(() => (this.muted() ? 'Activar sonido' : 'Silenciar'));
  /** Second path of the speaker icon: sound waves or an ✕. */
  readonly muteIcon = computed(() => (this.muted() ? 'M17 9l5 6M22 9l-5 6' : 'M17 8a5 5 0 0 1 0 8'));

  toggleMute(): void { this.muted.update(m => !m); }
  setVolume(v: number): void {
    this.volume.set(v);
    this.muted.set(v === 0);
  }

  /** Changes the CRT filters and remembers them on this browser. */
  setCrt(patch: Partial<CrtFilters>): void {
    const next = { ...this.crt(), ...patch };
    next.intensity = Math.min(100, Math.max(0, Math.round(next.intensity)));
    next.density = Math.min(10, Math.max(1, Math.round(next.density)));
    this.crt.set(next);
    try { localStorage.setItem(CRT_KEY, JSON.stringify(next)); } catch { /* Private mode: keep it for this visit only. */ }
  }
}

import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'nostalgiatv-tv-mode';

// User-agents de TVs/consolas (detección segura: un desktop/móvil normal NO matchea,
// así que no se activa el modo TV por error en esos dispositivos).
const TV_USER_AGENT =
  /smart[- ]?tv|tizen|webos|web0s|hbbtv|netcast|viera|bravia|aquos|philipstv|dtv|appletv|\bgoogletv\b|android ?tv|\btv\b safari|roku|aftb|aftm|aftt|afts|firetv|crkey|chromecast|ce-html|playstation|nintendo|xbox/i;

@Injectable({ providedIn: 'root' })
export class TvModeService {
  /** ¿El dispositivo parece una TV/consola? (para sugerir o entrar solo). */
  readonly suggested = signal(this.detectTv());

  /**
   * Estado del modo TV. Prioridad:
   *  1) preferencia guardada del usuario (si alguna vez lo activó/desactivó),
   *  2) si no hay preferencia y parece una TV → entra solo,
   *  3) si no → modo normal.
   */
  readonly enabled = signal(this.initialEnabled());

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

  private initialEnabled(): boolean {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === 'true';   // respeta la elección del usuario
    return this.suggested();                          // en una TV, entra solo
  }

  private detectTv(): boolean {
    if (typeof navigator === 'undefined') return false;
    return TV_USER_AGENT.test(navigator.userAgent);
  }
}

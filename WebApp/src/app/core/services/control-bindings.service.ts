import { Injectable, signal, computed } from '@angular/core';

/** Acciones del "mando" en modo TV/cine. */
export type TvAction = 'channelPrev' | 'channelNext' | 'ok' | 'guide' | 'image' | 'hide';

export const TV_ACTIONS: { action: TvAction; label: string }[] = [
  { action: 'channelPrev', label: 'Canal anterior' },
  { action: 'channelNext', label: 'Canal siguiente' },
  { action: 'ok', label: 'Sintonizar (OK)' },
  { action: 'guide', label: 'Guía' },
  { action: 'image', label: 'Ajustes de imagen' },
  { action: 'hide', label: 'Ocultar tira' },
];

const DEFAULTS: Record<TvAction, string> = {
  channelPrev: 'ArrowLeft',
  channelNext: 'ArrowRight',
  ok: 'Enter',
  guide: 'ArrowUp',
  image: 'ArrowDown',
  hide: 'Escape',
};

const STORAGE_KEY = 'nostalgiatv-controls';

/**
 * Remapeo de teclas tipo emulador: cada acción se asigna a una tecla del teclado
 * (o del control remoto), persistido en localStorage.
 */
@Injectable({ providedIn: 'root' })
export class ControlBindingsService {
  readonly bindings = signal<Record<TvAction, string>>(this.load());

  /** tecla -> acción (para buscar rápido en el keydown). */
  private readonly reverse = computed(() => {
    const map: Record<string, TvAction> = {};
    const b = this.bindings();
    (Object.keys(b) as TvAction[]).forEach(a => { if (b[a]) map[b[a]] = a; });
    return map;
  });

  actionFor(key: string): TvAction | undefined { return this.reverse()[key]; }

  set(action: TvAction, key: string): void {
    const b = { ...this.bindings() };
    // Una tecla no puede quedar asignada a dos acciones: si estaba usada, se libera.
    (Object.keys(b) as TvAction[]).forEach(a => { if (b[a] === key) b[a] = ''; });
    b[action] = key;
    this.bindings.set(b);
    this.save(b);
  }

  reset(): void { this.bindings.set({ ...DEFAULTS }); this.save(DEFAULTS); }

  /** Etiqueta legible de una tecla (ArrowLeft -> ◀, Enter -> Enter, ' ' -> Espacio). */
  keyLabel(key: string): string {
    if (!key) return '—';
    const map: Record<string, string> = {
      ArrowLeft: '◀', ArrowRight: '▶', ArrowUp: '▲', ArrowDown: '▼',
      ' ': 'Espacio', Enter: 'Enter', Escape: 'Esc', Backspace: '⌫',
    };
    return map[key] ?? key.toUpperCase();
  }

  private load(): Record<TvAction, string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch { return { ...DEFAULTS }; }
  }
  private save(b: Record<TvAction, string>): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  }
}

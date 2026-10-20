import { Injectable, signal } from '@angular/core';

/** Android TV mode switches of "Ajustes › Reproducción". */
export type TvPref = 'lastChannel' | 'channelNumber' | 'seasonal';

const PREFS_KEY = 'ntv.tv.prefs';
const PREF_DEFAULTS: Record<TvPref, boolean> = { lastChannel: true, channelNumber: true, seasonal: true };

function readPrefs(): Record<TvPref, boolean> {
  try { return { ...PREF_DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }; } catch { return { ...PREF_DEFAULTS }; }
}

/** TV mode preferences, remembered on this browser. */
@Injectable({ providedIn: 'root' })
export class TvPrefs {
  readonly values = signal(readPrefs());

  toggle(pref: TvPref): void {
    this.values.update(p => ({ ...p, [pref]: !p[pref] }));
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(this.values())); } catch { /* private mode */ }
  }
}

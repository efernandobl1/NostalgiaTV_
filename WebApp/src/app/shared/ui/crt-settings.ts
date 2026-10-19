import { Component, ElementRef, inject, input, signal } from '@angular/core';
import { CrtFilters, PlayerPrefs } from '../../core/player-prefs';

let next = 0;

/** "CRT" button of the player controls and its panel to tune the CRT filters over the video. */
@Component({
  selector: 'app-crt-settings',
  host: { class: 'relative inline-flex', '(document:keydown.escape)': 'open.set(false)', '(document:click)': 'outside($event)' },
  template: `
    <button type="button" [class]="buttonClass()" aria-label="Filtros CRT" aria-haspopup="dialog"
            [attr.aria-expanded]="open()" [attr.aria-controls]="panelId" [attr.aria-pressed]="prefs.crt().enabled"
            (click)="open.update(o => !o)">CRT</button>
    @if (open()) {
      <div class="absolute right-0 z-30 w-72 p-4 rounded-xl bg-panel border border-line shadow-[0_12px_32px_rgba(0,0,0,0.5)] flex flex-col gap-3 text-left text-fg font-sans"
           [class]="drop() === 'down' ? 'top-full mt-2' : 'bottom-full mb-2'" role="dialog" aria-label="Filtros de imagen" [id]="panelId">
        <span class="font-mono text-[11px] tracking-[0.12em] text-muted">LA IMAGEN DE ANTES</span>
        @for (s of switches; track s.key) {
          <label class="flex items-center justify-between gap-3 text-[14px]" [class.opacity-50]="s.key !== 'enabled' && !prefs.crt().enabled">
            {{ s.label }}
            <input type="checkbox" class="w-4.5 h-4.5 accent-amber" [checked]="prefs.crt()[s.key]"
                   [disabled]="s.key !== 'enabled' && !prefs.crt().enabled" (change)="set(s.key, $any($event.target).checked)">
          </label>
        }
        <label class="flex flex-col gap-1.5 text-[13px] text-muted" [class.opacity-50]="!prefs.crt().enabled">
          Intensidad de líneas · {{ prefs.crt().intensity }} %
          <input type="range" class="accent-amber" min="0" max="100" [value]="prefs.crt().intensity" [disabled]="!prefs.crt().enabled"
                 (input)="prefs.setCrt({ intensity: +$any($event.target).value })">
        </label>
        <label class="flex flex-col gap-1.5 text-[13px] text-muted" [class.opacity-50]="!prefs.crt().enabled">
          Separación de líneas · {{ prefs.crt().density }}
          <input type="range" class="accent-amber" min="1" max="10" [value]="prefs.crt().density" [disabled]="!prefs.crt().enabled"
                 (input)="prefs.setCrt({ density: +$any($event.target).value })">
        </label>
      </div>
    }
  `,
})
export class CrtSettings {
  protected readonly prefs = inject(PlayerPrefs);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Classes of the trigger, so it matches the surrounding controls. */
  readonly buttonClass = input('pill px-3 font-mono font-semibold text-[12px] aria-pressed:border-amber aria-pressed:text-amber');
  /** Opens the panel above the button (bottom controls) or below it (top bar). */
  readonly drop = input<'up' | 'down'>('up');

  readonly open = signal(false);
  protected readonly panelId = `crt-panel-${++next}`;
  protected readonly switches: { key: 'enabled' | 'curvature' | 'vignette' | 'animated'; label: string }[] = [
    { key: 'enabled', label: 'Efecto CRT' },
    { key: 'curvature', label: 'Curvatura' },
    { key: 'vignette', label: 'Oscurecer bordes' },
    { key: 'animated', label: 'Animación de líneas' },
  ];

  protected set(key: keyof CrtFilters, value: boolean): void { this.prefs.setCrt({ [key]: value }); }

  protected outside(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}

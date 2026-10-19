import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from '../../core/api/api';
import { lastChannel } from '../../core/data/public-data';
import { CrtFilters, PlayerPrefs } from '../../core/player-prefs';
import { Session } from '../../core/session';
import { TvPref, TvPrefs } from '../../core/tv-prefs';

type Kind = 'toggle' | 'range' | 'danger' | 'link' | undefined;
type CrtSwitch = 'enabled' | 'curvature' | 'vignette' | 'animated';
type CrtLevel = 'intensity' | 'density';
interface Row {
  label: string; hint: string; value: string; kind?: Kind; on?: boolean; pref?: TvPref; action?: 'signout' | 'history' | 'series';
  /** CRT filter the row switches (toggle) or adjusts with ◀ ▶ (range). */
  crt?: CrtSwitch | CrtLevel; disabled?: boolean;
}

/** ◀ ▶ step, range and wrap-around of the CRT sliders on the TV. */
const LEVELS: Record<CrtLevel, { step: number; min: number; max: number }> = {
  intensity: { step: 10, min: 0, max: 100 },
  density: { step: 1, min: 1, max: 10 },
};

/** Next value of a CRT level for ◀ (−1) or ▶ (+1); OK (`wrap`) goes past the top back to the bottom. */
export function stepLevel(key: CrtLevel, value: number, direction: 1 | -1, wrap = false): number {
  const { step, min, max } = LEVELS[key];
  const next = value + direction * step;
  if (wrap && next > max) return min;
  return Math.min(max, Math.max(min, next));
}

const SECTION_NAMES = ['Perfil', 'Reproducción', 'Imagen', 'Dispositivo', 'Acerca de'];

/** Design: "Android TV · Perfil y ajustes". Focusing a section on the left shows it on the right. */
@Component({
  selector: 'app-tv-settings',
  host: { class: 'w-full h-full overflow-hidden py-16 px-24 flex gap-16 bg-ink-2' },
  template: `
    <nav class="w-130 flex-none flex flex-col gap-2.5" aria-label="Ajustes">
      <div class="flex items-center gap-5 mb-7">
        <span class="w-22 h-22 rounded-full flex items-center justify-center font-display font-bold text-[34px] text-on-amber bg-amber" aria-hidden="true">{{ session.initials() }}</span>
        <span class="flex flex-col gap-1"><span class="font-display font-bold text-[40px]">{{ session.user() }}</span><span class="text-[20px] text-muted">{{ device()?.name ?? 'Este televisor' }}</span></span>
      </div>
      @for (s of sections; track s; let k = $index) {
        <button type="button" class="h-20 flex items-center px-8 border-0 rounded-[40px] font-semibold text-[26px] font-sans cursor-pointer outline-none bg-transparent text-fg-2 aria-pressed:bg-fg aria-pressed:text-ink-2 focus:shadow-[0_0_0_4px_#0B0B09,0_0_0_8px_#FFB547]"
                [attr.aria-pressed]="k === section()" [attr.data-autofocus]="k === 1 ? '' : null" (focus)="section.set(k)" (click)="section.set(k)">
          {{ s }} <span class="ml-auto opacity-60" aria-hidden="true">›</span>
        </button>
      }
    </nav>

    <section class="flex-1 flex flex-col gap-3.5 py-10 px-12 rounded-[28px] bg-panel-2">
      <h1 class="m-0 mb-4 font-display font-bold text-[48px]">{{ sections[section()] }}</h1>
      @for (r of rows(); track r.label; let k = $index) {
        <button type="button" class="flex items-center gap-6 min-h-26 px-7 rounded-[18px] border-0 bg-transparent text-left font-sans cursor-pointer outline-none focus:bg-raised-2 focus:shadow-[inset_0_0_0_2px_#3A3A33]"
                [class.opacity-50]="r.disabled" [attr.aria-disabled]="r.disabled || null" (click)="activate(k)" (keydown)="adjust($event, k)">
          <span class="flex-1 flex flex-col gap-1.5">
            <span class="text-[26px] font-semibold" [class]="r.kind === 'danger' ? 'text-danger' : 'text-fg'">{{ r.label }}</span>
            <span class="text-[19px] text-muted">{{ r.hint }}</span>
          </span>
          <span class="font-mono text-[22px]" [class]="r.kind === 'toggle' && r.on ? 'text-ok' : 'text-fg-2'">{{ r.kind === 'toggle' ? (r.on ? 'SÍ' : 'NO') : r.kind === 'range' ? '◀ ' + r.value + ' ▶' : r.value }}</span>
        </button>
      }
    </section>
  `,
})
export class TvSettings {
  private readonly router = inject(Router);
  private readonly api = inject(Api);
  protected readonly session = inject(Session);
  private readonly tvPrefs = inject(TvPrefs);
  private readonly player = inject(PlayerPrefs);
  readonly sections = SECTION_NAMES;
  readonly section = signal(1);
  readonly device = computed(() => this.session.viewer()?.devices.find(d => d.current) ?? null);

  private readonly data = computed<Row[][]>(() => {
    const viewer = this.session.viewer();
    const prefs = this.tvPrefs.values();
    const crt = this.player.crt();
    const progress = viewer?.progress ?? [];
    const done = progress.filter(p => p.completed).length;
    const last = lastChannel();
    const expires = this.device()?.expiresAtUtc;
    return [
      [
        { label: 'Usuario', hint: viewer?.accountLinked ? 'Cuenta de espectador' : 'Perfil sin cuenta', value: viewer?.username ?? 'Invitado' },
        { label: 'Historial de visualización', hint: `${done} episodios vistos · se sincroniza con la web`, value: `${progress.length} ›`, kind: 'link', action: 'series' },
        { label: 'Borrar historial', hint: 'Elimina el progreso de todas las series', value: '›', kind: 'danger', action: 'history' },
        { label: 'Cerrar sesión en este TV', hint: 'Tendrás que vincularlo de nuevo', value: '›', kind: 'danger', action: 'signout' },
      ],
      [
        { label: 'Iniciar en el último canal', hint: last ? `Al abrir la app sintoniza CH ${String(last).padStart(2, '0')}` : 'Al abrir la app sintoniza el último canal', value: '', kind: 'toggle', on: prefs.lastChannel, pref: 'lastChannel' },
        { label: 'Mostrar número al cambiar de canal', hint: 'Número verde estilo TV de tubo', value: '', kind: 'toggle', on: prefs.channelNumber, pref: 'channelNumber' },
        { label: 'Efectos de temporada', hint: 'Halloween y Navidad en pantalla', value: '', kind: 'toggle', on: prefs.seasonal, pref: 'seasonal' },
        { label: 'Calidad de video', hint: 'Se ajusta a tu conexión', value: 'AUTOMÁTICA' },
      ],
      [
        { label: 'Efecto CRT', hint: 'Líneas de barrido sobre el video, como en la tele de tubo', value: '', kind: 'toggle', on: crt.enabled, crt: 'enabled' },
        { label: 'Curvatura', hint: 'Sombra de pantalla curva en las esquinas', value: '', kind: 'toggle', on: crt.curvature, crt: 'curvature', disabled: !crt.enabled },
        { label: 'Oscurecer bordes', hint: 'Viñeta alrededor de la imagen', value: '', kind: 'toggle', on: crt.vignette, crt: 'vignette', disabled: !crt.enabled },
        { label: 'Animación de líneas', hint: 'Las líneas se desplazan lentamente', value: '', kind: 'toggle', on: crt.animated, crt: 'animated', disabled: !crt.enabled },
        { label: 'Intensidad de líneas', hint: 'Usa ◀ ▶ para ajustar', value: `${crt.intensity} %`, kind: 'range', crt: 'intensity', disabled: !crt.enabled },
        { label: 'Separación de líneas', hint: 'Usa ◀ ▶ para ajustar', value: String(crt.density), kind: 'range', crt: 'density', disabled: !crt.enabled },
      ],
      [
        { label: 'Nombre', hint: 'Así aparece en Mis dispositivos', value: this.device()?.name ?? '—' },
        { label: 'Sesión válida hasta', hint: 'Se renueva al usar la app', value: expires ? new Date(expires).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : '—' },
        { label: 'Desvincular este TV', hint: 'Cierra la sesión del dispositivo', value: '›', kind: 'danger', action: 'signout' },
      ],
      [
        { label: 'Versión de la app', hint: 'NostalgiaTV web', value: '2.0.0' },
        { label: 'Servidor', hint: 'Donde está tu NostalgiaTV', value: (window.location.host || 'TU-SERVIDOR').toUpperCase() },
      ],
    ];
  });
  readonly rows = computed(() => this.data()[this.section()]);

  async activate(index: number): Promise<void> {
    const row = this.rows()[index];
    if (row.disabled) return;
    if (row.kind === 'toggle' && row.pref) {
      this.tvPrefs.toggle(row.pref);
    } else if (row.kind === 'toggle' && row.crt) {
      const key = row.crt as CrtSwitch;
      this.player.setCrt({ [key]: !this.player.crt()[key] });
    } else if (row.kind === 'range' && row.crt) {
      this.level(row.crt as CrtLevel, 1, true);
    } else if (row.action === 'series') {
      this.router.navigateByUrl('/tv/series');
    } else if (row.action === 'history') {
      await this.api.clearHistory().catch(() => undefined);
      await this.session.refreshViewer();
    } else if (row.action === 'signout') {
      const device = this.device();
      if (device) await this.api.removeDevice(device.id).catch(() => undefined);
      if (this.session.signedIn()) await this.session.signOut(); else await this.session.ensureViewer();
      this.router.navigateByUrl('/tv/vincular');
    }
  }

  /** ◀ ▶ on a CRT level row change its value instead of moving the focus. */
  adjust(event: KeyboardEvent, index: number): void {
    const row = this.rows()[index];
    if (row.kind !== 'range' || !row.crt || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    if (!row.disabled) this.level(row.crt as CrtLevel, event.key === 'ArrowRight' ? 1 : -1);
  }

  private level(key: CrtLevel, direction: 1 | -1, wrap = false): void {
    const patch: Partial<CrtFilters> = { [key]: stepLevel(key, this.player.crt()[key], direction, wrap) };
    this.player.setCrt(patch);
  }
}

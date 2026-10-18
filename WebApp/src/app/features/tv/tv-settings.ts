import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Session } from '../../core/session';

type Kind = 'toggle' | 'danger' | 'link' | undefined;
interface Row { label: string; hint: string; value: string; kind?: Kind; on?: boolean; action?: 'signout' | 'history' }

const SECTIONS: [string, Row[]][] = [
  ['Perfil', [
    { label: 'Usuario', hint: 'Cuenta de espectador', value: 'fernando' },
    { label: 'Historial de visualización', hint: '128 episodios · se sincroniza con la web', value: 'Ver ›', kind: 'link' },
    { label: 'Borrar historial', hint: 'Elimina el progreso de todas las series', value: '›', kind: 'danger', action: 'history' },
    { label: 'Cerrar sesión en este TV', hint: 'Tendrás que vincularlo de nuevo', value: '›', kind: 'danger', action: 'signout' },
  ]],
  ['Reproducción', [
    { label: 'Iniciar en el último canal', hint: 'Al abrir la app sintoniza CH 05', value: '', kind: 'toggle', on: true },
    { label: 'Mostrar número al cambiar de canal', hint: 'Número verde estilo TV de tubo', value: '', kind: 'toggle', on: true },
    { label: 'Efectos de temporada', hint: 'Halloween y Navidad en pantalla', value: '', kind: 'toggle', on: true },
    { label: 'Calidad de video', hint: 'Se ajusta a tu conexión', value: 'AUTOMÁTICA' },
  ]],
  ['Subtítulos', [
    { label: 'Subtítulos', hint: 'Cuando el episodio los tenga', value: '', kind: 'toggle', on: false },
    { label: 'Tamaño', hint: 'Texto de los subtítulos', value: 'GRANDE' },
    { label: 'Fondo', hint: 'Mejora la lectura', value: 'SEMITRANSPARENTE' },
  ]],
  ['Dispositivo', [
    { label: 'Nombre', hint: 'Así aparece en Mis dispositivos', value: 'Smart TV sala' },
    { label: 'Sesión válida hasta', hint: 'Se renueva al usar la app', value: '16 NOV 2026' },
    { label: 'Desvincular este TV', hint: 'Cierra la sesión y borra el código', value: '›', kind: 'danger', action: 'signout' },
  ]],
  ['Acerca de', [
    { label: 'Versión de la app', hint: 'Android TV', value: '2.0.0' },
    { label: 'Servidor', hint: 'Donde está tu NostalgiaTV', value: 'TU-SERVIDOR' },
    { label: 'Buscar actualizaciones', hint: 'Última revisión hoy', value: '›' },
  ]],
];

/** Design: "Android TV · Perfil y ajustes". Focusing a section on the left shows it on the right. */
@Component({
  selector: 'app-tv-settings',
  host: { class: 'w-full h-full overflow-hidden py-16 px-24 flex gap-16 bg-ink-2' },
  template: `
    <nav class="w-130 flex-none flex flex-col gap-2.5" aria-label="Ajustes">
      <div class="flex items-center gap-5 mb-7">
        <span class="w-22 h-22 rounded-full flex items-center justify-center font-display font-bold text-[34px] text-on-amber bg-amber" aria-hidden="true">{{ session.initials }}</span>
        <span class="flex flex-col gap-1"><span class="font-display font-bold text-[40px]">{{ session.user }}</span><span class="text-[20px] text-muted">Smart TV sala</span></span>
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
                (click)="activate(k)">
          <span class="flex-1 flex flex-col gap-1.5">
            <span class="text-[26px] font-semibold" [class]="r.kind === 'danger' ? 'text-danger' : 'text-fg'">{{ r.label }}</span>
            <span class="text-[19px] text-muted">{{ r.hint }}</span>
          </span>
          <span class="font-mono text-[22px]" [class]="r.kind === 'toggle' && r.on ? 'text-ok' : 'text-fg-2'">{{ r.kind === 'toggle' ? (r.on ? 'SÍ' : 'NO') : r.value }}</span>
        </button>
      }
    </section>
  `,
})
export class TvSettings {
  private readonly router = inject(Router);
  protected readonly session = inject(Session);
  readonly sections = SECTIONS.map(([label]) => label);
  readonly section = signal(1);
  private readonly data = signal(SECTIONS.map(([, rows]) => rows));
  readonly rows = computed(() => this.data()[this.section()]);

  activate(index: number): void {
    const row = this.rows()[index];
    if (row.kind === 'toggle') {
      this.data.update(all => all.map((rows, s) => (s === this.section() ? rows.map((r, i) => (i === index ? { ...r, on: !r.on } : r)) : rows)));
    } else if (row.action === 'signout') {
      this.session.signOut();
      this.router.navigateByUrl('/tv/vincular');
    }
  }
}

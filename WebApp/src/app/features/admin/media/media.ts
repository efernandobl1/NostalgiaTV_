import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeader } from '../../../shared/ui/page-header';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { ClearQueueDialog } from './clear-queue-dialog';

const C: Record<string, [string, string]> = {
  Queued: ['EN COLA', '#A29E91'], Processing: ['PROCESANDO', '#6FD0EA'], Completed: ['COMPLETADO', '#8BE08F'],
  Failed: ['FALLIDO', '#FF8A80'], Skipped: ['OMITIDO', '#8C887D'],
};
const TABS: [string, string, number][] = [['Todos', 'All', 1342], ['En cola', 'Queued', 18], ['Procesando', 'Processing', 3], ['Completados', 'Completed', 1309], ['Fallidos', 'Failed', 7], ['Omitidos', 'Skipped', 5]];
const JOBS: [string, string, string, string, number, string, string][] = [
  ['Pokémon', 'transcode', '/media/series/pokemon/T03/E02.mkv', '1.2 GB', 62, 'Processing', 'h264 → 720p'],
  ['Digimon Adventure', 'transcode', '/media/series/digimon/T01/E44.avi', '640 MB', 18, 'Processing', 'h264 → 720p'],
  ['Hey Arnold!', 'probe', '/media/series/hey-arnold/T02/E09.mp4', '410 MB', 90, 'Processing', 'Leyendo metadatos'],
  ['Los Simpson', 'thumbnails', '/media/series/simpson/T05/E01.mkv', '980 MB', 0, 'Queued', '—'],
  ['Dragon Ball Z', 'transcode', '/media/series/dbz/T04/E12.mkv', '1.4 GB', 100, 'Failed', 'Stream de audio inválido'],
  ['Dragon Ball Z', 'transcode', '/media/series/dbz/T04/E11.mkv', '1.4 GB', 100, 'Completed', 'OK · 21:38'],
  ['Los Caballeros del Zodiaco', 'probe', '/media/series/saint-seiya/T01/E31.mp4', '520 MB', 100, 'Skipped', 'Huella sin cambios'],
];
const fmt = (n: number) => n.toLocaleString('es-GT');

@Component({
  selector: 'app-media',
  imports: [RouterLink, PageHeader, ConfirmDialog, ClearQueueDialog],
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './media.html',
})
export class Media {
  readonly tabs = TABS;
  readonly workers = signal([
    { id: 'transcode', enabled: true, color: '#8BE08F', beat: 'Latido hace 4 s', load: '2 jobs · 4 / 4 núcleos' },
    { id: 'probe', enabled: true, color: '#8BE08F', beat: 'Latido hace 9 s', load: '1 job' },
    { id: 'thumbnails', enabled: false, color: '#A29E91', beat: 'Sin latido · deshabilitado', load: '0 jobs' },
  ]);
  readonly tab = signal(0);
  readonly sel = signal<Record<number, boolean>>({});
  readonly allMatching = signal(false);
  readonly dlg = signal<'clear' | 'delete' | null>(null);
  readonly page = signal(1);

  readonly jobs = computed(() => {
    const key = TABS[this.tab()][1];
    return JOBS.map((j, id) => ({ id, j }))
      .filter(({ j }) => key === 'All' || j[5] === key)
      .map(({ id, j: [series, worker, path, size, progress, st, msg] }) => ({
        id, series, worker, path, size, progress, msg, status: C[st][0], color: C[st][1], selected: !!this.sel()[id],
      }));
  });
  readonly matchingNum = computed(() => TABS[this.tab()][2]);
  readonly matching = computed(() => fmt(this.matchingNum()));
  readonly selCountNum = computed(() => this.allMatching() ? this.matchingNum() : Object.values(this.sel()).filter(Boolean).length);
  readonly selCount = computed(() => fmt(this.selCountNum()));
  readonly allOnPage = computed(() => this.jobs().length > 0 && this.jobs().every(j => j.selected));
  readonly pages = computed(() => ['1', '2', '3', '…', String(Math.max(1, Math.ceil(this.matchingNum() / 50)))]);

  pickTab(i: number): void { this.tab.set(i); this.page.set(1); }
  toggle(id: number): void { this.sel.update(s => ({ ...s, [id]: !s[id] })); this.allMatching.set(false); }
  togglePage(): void {
    const next = { ...this.sel() }, value = !this.allOnPage();
    for (const j of this.jobs()) next[j.id] = value;
    this.sel.set(next);
    this.allMatching.set(false);
  }
  clearSel(): void { this.sel.set({}); this.allMatching.set(false); }
  toggleWorker(i: number): void { this.workers.update(ws => ws.map((w, k) => (k === i ? { ...w, enabled: !w.enabled } : w))); }
}

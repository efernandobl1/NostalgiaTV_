import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../../core/api/admin-api';
import { errorMessage } from '../../../core/api/api';
import { ChannelDetail, ChannelListItem, PlatformSettings, ScheduleProgram, ScheduleSegment } from '../../../core/api/models';
import { channelNumber, dayKey, episodeCode, hhmm, playTime } from '../../../core/data/public-data';
import { Session } from '../../../core/session';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { PageHeader } from '../../../shared/ui/page-header';

const SEG_COLORS: Record<string, string> = { Episode: '#FFB547', Advertisement: '#6FD0EA', Bumper: '#B8A6FF' };
const SEG_LABELS: Record<string, string> = { Episode: 'EPISODIO', Advertisement: 'ANUNCIO', Bumper: 'BUMPER' };

function seconds(from: string, to: string): number { return (new Date(to).getTime() - new Date(from).getTime()) / 1000; }

@Component({
  selector: 'app-schedule',
  imports: [RouterLink, PageHeader, ConfirmDialog],
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './schedule.html',
})
export class Schedule {
  private readonly admin = inject(AdminApi);
  private readonly session = inject(Session);

  readonly list = signal<ChannelListItem[]>([]);
  readonly channels = computed(() => this.list().map(c => ({ id: c.id, code: `CH ${channelNumber(c.id)}`, name: c.name })));
  readonly channel = signal(0);
  readonly day = signal(dayKey(0, this.session.settings()?.timeZoneId));
  readonly detail = signal<ChannelDetail | null>(null);
  readonly raw = signal<ScheduleProgram[]>([]);
  readonly settings = signal<PlatformSettings | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly notice = signal('');
  readonly program = signal(0);
  readonly regenOpen = signal(false);

  readonly era = computed(() => this.detail()?.eras.find(e => e.id === this.detail()?.activeEraId) ?? null);

  readonly programs = computed(() => {
    const now = Date.now();
    return this.raw().map(p => {
      const total = Math.max(1, seconds(p.startsAtUtc, p.endsAtUtc));
      return {
        start: hhmm(p.startsAtUtc), end: hhmm(p.endsAtUtc), title: p.seriesName, code: episodeCode(p.seasonNumber, p.episodeNumber, p.episodeType, p.episodePart) || p.episodeType,
        type: p.episodeType, live: new Date(p.startsAtUtc).getTime() <= now && new Date(p.endsAtUtc).getTime() > now,
        segs: p.segments.map(s => ({ w: Math.max(0.2, seconds(s.startsAtUtc, s.endsAtUtc) * 24 / total), color: SEG_COLORS[s.kind] ?? '#3A3A33' })),
      };
    });
  });
  readonly sel = computed(() => this.programs()[this.program()] ?? null);
  readonly segRows = computed(() => {
    const p = this.raw()[this.program()];
    if (!p) return [];
    return p.segments.map((s: ScheduleSegment, i) => ({
      at: i === 0 ? hhmm(s.startsAtUtc) : `+${playTime(seconds(p.startsAtUtc, s.startsAtUtc))}`,
      kind: s.inAdBreak && s.kind !== 'Episode' ? `${SEG_LABELS[s.kind] ?? s.kind.toUpperCase()}` : SEG_LABELS[s.kind] ?? s.kind.toUpperCase(),
      color: SEG_COLORS[s.kind] ?? '#A29E91',
      content: s.kind === 'Episode' ? `Bloque ${p.segments.slice(0, i + 1).filter(x => x.kind === 'Episode').length}` : s.title,
      range: s.kind === 'Episode' && s.mediaStartSecond !== null && s.mediaEndSecond !== null
        ? `${playTime(s.mediaStartSecond)} → ${playTime(s.mediaEndSecond)}` : playTime(seconds(s.startsAtUtc, s.endsAtUtc)),
    }));
  });

  readonly rules = computed(() => {
    const s = this.settings();
    const rule = this.era()?.breakRule;
    return [
      { label: 'Ventana sin repetir', value: s ? `${s.noRepeatWindowHours} h` : '—' },
      { label: 'Especiales por día', value: s ? `${s.maxSpecialsPerDay} · máx ${s.maxSpecialsPerSeriesPerDay} por serie` : '—' },
      { label: 'Películas por día', value: s ? `${s.maxMoviesPerDay} · máx ${s.maxMoviesPerSeriesPerDay} por serie` : '—' },
      { label: 'Anuncios por corte (era)', value: rule ? `${rule.minimumAds} – ${rule.maximumAds}` : 'Sin cortes' },
      { label: 'Duración máx. de corte', value: rule ? `${rule.maximumBreakSeconds} s` : '—' },
    ];
  });

  constructor() {
    this.admin.channels().then(list => this.list.set(list)).catch(error => this.error.set(errorMessage(error, 'No se pudieron cargar los canales.')));
    if (this.session.canOpen('/admin/ajustes')) this.admin.settings().then(s => this.settings.set(s)).catch(() => {});
    effect(() => {
      const channel = this.list()[this.channel()];
      const day = this.day();
      untracked(() => { if (channel) this.load(channel.id, day); });
    });
  }

  private async load(channelId: number, day: string): Promise<void> {
    this.loading.set(true);
    const from = new Date(`${day}T00:00:00`);
    const to = new Date(from.getTime() + 24 * 60 * 60_000);
    try {
      const [programs, detail] = await Promise.all([this.admin.programs(channelId, from.toISOString(), to.toISOString()), this.admin.channel(channelId)]);
      this.raw.set(programs);
      this.detail.set(detail);
      const now = Date.now();
      this.program.set(Math.max(0, programs.findIndex(p => new Date(p.endsAtUtc).getTime() > now)));
      this.error.set('');
    } catch (error) {
      this.raw.set([]);
      this.error.set(errorMessage(error, 'No se pudo cargar la programación.'));
    } finally {
      this.loading.set(false);
    }
  }

  async regenerate(): Promise<void> {
    const channel = this.list()[this.channel()];
    if (!channel) return;
    try {
      await this.admin.regenerate(channel.id);
      this.notice.set('Programación regenerada.');
      await this.load(channel.id, this.day());
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo regenerar la programación.'));
    }
  }

  /** CSV of the day shown (opens in any spreadsheet). */
  exportGuide(): void {
    const channel = this.list()[this.channel()];
    const rows = [['Inicio', 'Fin', 'Serie', 'Episodio', 'Título', 'Tipo'], ...this.raw().map(p => [
      new Date(p.startsAtUtc).toLocaleString('es'), new Date(p.endsAtUtc).toLocaleString('es'), p.seriesName,
      episodeCode(p.seasonNumber, p.episodeNumber, p.episodeType, p.episodePart), p.title, p.episodeType,
    ])];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `guia-${channel ? channelNumber(channel.id) : 'canal'}-${this.day()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}

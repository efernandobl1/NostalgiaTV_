import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { AdminApi } from '../../../core/api/admin-api';
import { errorMessage, mediaUrl } from '../../../core/api/api';
import { ChannelDetail, ChannelListItem, EraInterludeItem, EraSeriesItem } from '../../../core/api/models';
import { channelNumber, years } from '../../../core/data/public-data';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { PageHeader } from '../../../shared/ui/page-header';
import { copyLink } from '../../../shared/utils/share';
import { interludeTag } from '../interludes/interlude-labels';
import { ChannelDialog } from './channel-dialog';
import { EraDialog } from './era-dialog';
import { EraInterludeDialog } from './era-interlude-dialog';
import { EraSeriesDialog } from './era-series-dialog';

type Dlg = 'channel' | 'era' | 'eraSeries' | 'eraInterlude' | 'broadcast' | null;

const ALL = [{ label: 'Todas', ink: '#ECE8DC', bg: '#3A3A33' }];

function gapLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 3600)} h`;
}

@Component({
  selector: 'app-channels',
  imports: [PageHeader, ConfirmDialog, ChannelDialog, EraDialog, EraSeriesDialog, EraInterludeDialog],
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './channels.html',
})
export class Channels {
  private readonly admin = inject(AdminApi);

  readonly list = signal<ChannelListItem[]>([]);
  readonly channels = computed(() => this.list().map(c => ({ id: c.id, num: channelNumber(c.id), name: c.name, era: c.activeEraName ?? 'Sin era seleccionada' })));
  readonly channel = signal(0);
  readonly detail = signal<ChannelDetail | null>(null);
  readonly eraIndex = signal(0);
  readonly dlg = signal<Dlg>(null);
  readonly mode = signal<'create' | 'edit'>('edit');
  readonly error = signal('');
  readonly notice = signal('');
  readonly loading = signal(true);

  readonly info = computed(() => {
    const d = this.detail();
    if (!d) return null;
    const date = (iso: string) => new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
    return { name: d.name, since: `Desde ${date(d.startDate)}`, until: d.endDate ? `Cierre ${date(d.endDate)}` : 'Sin fecha de cierre', shareId: d.shareId, history: d.history ?? '', logo: mediaUrl(d.logoPath) };
  });

  readonly eras = computed(() => (this.detail()?.eras ?? []).map(e => ({
    id: e.id, name: e.name, years: years(e.historicalStartDate, e.historicalEndDate), w: Math.max(2, e.seriesCount),
    desc: e.description ?? 'Sin descripción.', onAir: e.id === this.detail()?.activeEraId, item: e,
  })));
  readonly era = computed(() => this.eras().at(this.eraIndex()) ?? null);

  readonly rawSeries = signal<EraSeriesItem[]>([]);
  readonly rawInterludes = signal<EraInterludeItem[]>([]);
  readonly eraSeries = computed(() => this.rawSeries().map(s => {
    const own = this.rawInterludes().filter(i => i.seriesId === s.seriesId).length;
    return {
      name: s.name,
      seasons: s.seasons.length ? [...s.seasons].sort((a, b) => a - b).map(n => ({ label: n === 0 ? 'Esp.' : `T${n}`, ink: '#1A1206', bg: '#FFB547' })) : ALL,
      interludes: own ? `${own} ${own === 1 ? 'interludio' : 'interludios'}` : '—',
    };
  }));
  readonly eraInterludes = computed(() => this.rawInterludes().map(i => ({
    ...interludeTag(i.kind, i.bumperType), kind: interludeTag(i.kind, i.bumperType).tag, title: i.seriesName ? `${i.title} · solo ${i.seriesName}` : i.title,
    weight: i.weight, gap: gapLabel(i.minimumGapSeconds), id: i.interludeId, seriesId: i.seriesId,
  })));

  // Break rule of the selected era, edited inline.
  readonly minAds = signal<number | string>('');
  readonly maxAds = signal<number | string>('');
  readonly maxSeconds = signal<number | string>('');

  constructor() {
    this.loadList();
    effect(() => {
      const channel = this.list()[this.channel()];
      untracked(() => { if (channel) this.loadDetail(channel.id); else this.detail.set(null); });
    });
    effect(() => {
      const era = this.era();
      const channelId = this.detail()?.id;
      untracked(() => {
        this.minAds.set(era?.item.breakRule?.minimumAds ?? '');
        this.maxAds.set(era?.item.breakRule?.maximumAds ?? '');
        this.maxSeconds.set(era?.item.breakRule?.maximumBreakSeconds ?? '');
        this.rawSeries.set([]);
        this.rawInterludes.set([]);
        if (era && channelId) this.loadEra(channelId, era.id);
      });
    });
  }

  private async loadList(selectId?: number): Promise<void> {
    try {
      const list = await this.admin.channels();
      this.list.set(list);
      if (selectId) this.channel.set(Math.max(0, list.findIndex(c => c.id === selectId)));
      else if (this.channel() >= list.length) this.channel.set(0);
      this.error.set('');
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudieron cargar los canales.'));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadDetail(id: number, eraId?: number): Promise<void> {
    try {
      const detail = await this.admin.channel(id);
      this.detail.set(detail);
      const index = detail.eras.findIndex(e => e.id === (eraId ?? detail.activeEraId));
      this.eraIndex.set(Math.max(0, index));
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo cargar el canal.'));
    }
  }

  private async loadEra(channelId: number, eraId: number): Promise<void> {
    try {
      const [series, interludes] = await Promise.all([this.admin.eraSeries(channelId, eraId), this.admin.eraInterludes(channelId, eraId)]);
      if (this.era()?.id !== eraId) return;
      this.rawSeries.set(series);
      this.rawInterludes.set(interludes);
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo cargar la era.'));
    }
  }

  open(dlg: Dlg, mode: 'create' | 'edit' = 'edit'): void {
    this.mode.set(mode);
    this.dlg.set(dlg);
  }

  /** After a dialog saved: reload the list and the open channel/era. */
  async refresh(channelId?: number): Promise<void> {
    this.dlg.set(null);
    const id = channelId ?? this.detail()?.id;
    const eraId = this.era()?.id;
    await this.loadList(id);
    if (id) await this.loadDetail(id, eraId);
    const era = this.era();
    if (id && era) await this.loadEra(id, era.id);
  }

  async channelDeleted(): Promise<void> {
    this.dlg.set(null);
    this.channel.set(0);
    await this.loadList();
  }

  async broadcast(): Promise<void> {
    const id = this.detail()?.id, era = this.era();
    if (!id || !era) return;
    try {
      await this.admin.activateEra(id, era.id);
      this.notice.set(`La era «${era.name}» está al aire.`);
      await this.refresh();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo emitir la era.'));
    }
  }

  async saveBreakRule(): Promise<void> {
    const id = this.detail()?.id, era = this.era();
    if (!id || !era) return;
    const values = [this.minAds(), this.maxAds(), this.maxSeconds()].map(v => Number(v) || 0);
    try {
      if (values.every(v => v > 0)) await this.admin.setBreakRule(id, era.id, { minimumAds: values[0], maximumAds: values[1], maximumBreakSeconds: values[2] });
      else await this.admin.removeBreakRule(id, era.id);
      this.notice.set('Reglas de corte guardadas.');
      await this.loadDetail(id, era.id);
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudieron guardar las reglas de corte.'));
    }
  }

  async removeInterlude(interludeId: number, seriesId: number | null): Promise<void> {
    const id = this.detail()?.id, era = this.era();
    if (!id || !era) return;
    try {
      await this.admin.removeInterlude(id, era.id, interludeId, seriesId);
      await this.loadEra(id, era.id);
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo quitar el interludio.'));
    }
  }

  share(): void { const id = this.detail()?.id; if (id) copyLink(`/canal/${id}`); }
}

import { Component, computed, effect, inject, input, numberAttribute, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, errorMessage, mediaUrl } from '../../../core/api/api';
import { PublicChannelDetail, PublicComment } from '../../../core/api/models';
import { ago, channelNumber, hhmm, PublicData, slotLine, years } from '../../../core/data/public-data';
import { Poster } from '../../../shared/ui/poster';
import { copyLink } from '../../../shared/utils/share';

/** "T1–T3", "T2" or "Especiales" from the seasons an era airs. */
function seasonsLabel(seasons: number[]): string {
  const regular = seasons.filter(s => s > 0).sort((a, b) => a - b);
  if (!regular.length) return seasons.length ? 'Especiales' : 'Todas';
  return regular.length === 1 ? `T${regular[0]}` : `T${regular[0]}–T${regular[regular.length - 1]}`;
}

/** Design: "Web · Detalle de canal" + "Móvil · Detalle de canal". */
@Component({
  selector: 'app-channel-detail',
  imports: [RouterLink, Poster],
  host: { class: 'flex-1 flex flex-col' },
  templateUrl: './channel-detail.html',
})
export class ChannelDetail {
  private readonly api = inject(Api);
  private readonly data = inject(PublicData);

  /** Route param `:id`. */
  readonly id = input(0, { transform: numberAttribute });
  readonly detail = signal<PublicChannelDetail | null>(null);
  readonly error = signal('');
  private readonly rawComments = signal<PublicComment[]>([]);

  readonly channel = computed(() => {
    const d = this.detail();
    const since = d ? new Date(d.startDate).toLocaleDateString('es', { month: 'long', year: 'numeric' }).toUpperCase() : '';
    return { id: this.id(), num: channelNumber(this.id()), name: d?.name ?? '', history: d?.history ?? '', since, logo: mediaUrl(d?.logoPath), on: this.data.channel(this.id())?.on ?? false };
  });

  readonly eras = computed(() => (this.detail()?.eras ?? []).map(e => ({
    id: e.id, name: e.name, years: years(e.historicalStartDate, e.historicalEndDate), w: Math.max(1, e.series.length), onAir: e.id === this.detail()?.activeEraId,
    desc: e.description ?? '', mobileDesc: e.description ?? '', series: e.series,
  })));
  readonly eraIndex = signal(0);
  readonly era = computed(() => this.eras().at(this.eraIndex()) ?? null);
  readonly activeEra = computed(() => this.eras().find(e => e.onAir) ?? null);
  readonly series = computed(() => (this.era()?.series ?? []).map(s => ({ id: s.seriesId, name: s.name, seasons: seasonsLabel(s.seasons), image: mediaUrl(s.logoPath) })));
  readonly upcoming = computed(() => (this.detail()?.upcoming ?? []).slice(0, 5).map(s => ({
    time: hhmm(s.startsAtUtc), title: s.seriesName, sub: s.isNow ? `${slotLine(s)} · ahora` : slotLine(s), color: s.isNow ? '#FF8A80' : '#ECE8DC',
  })));
  readonly comments = computed(() => this.rawComments().filter(c => !c.parentCommentId).slice(0, 3).map(c => ({ id: c.id, user: c.author, time: ago(c.createdAtUtc), body: c.body })));
  readonly commentCount = computed(() => this.detail()?.commentCount ?? 0);

  constructor() {
    this.data.use();
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  private async load(id: number): Promise<void> {
    if (!id) return;
    try {
      const detail = await this.api.channel(id);
      this.detail.set(detail);
      this.eraIndex.set(Math.max(0, detail.eras.findIndex(e => e.id === detail.activeEraId)));
      this.error.set('');
      this.api.channelComments(id).then(page => this.rawComments.set(page.items)).catch(() => {});
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo cargar el canal.'));
    }
  }

  share(): void { copyLink(`/canal/${this.id()}`); }
}

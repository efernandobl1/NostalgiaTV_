import { Component, computed, input, numberAttribute, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CHANNELS } from '../../../core/data/channels';
import { seriesIdByName } from '../../../core/data/series';
import { Poster } from '../../../shared/ui/poster';
import { copyLink } from '../../../shared/utils/share';
import { CHANNEL_COMMENTS, CHANNEL_ERAS, UPCOMING } from './channel-detail.data';

/** Design: "Web · Detalle de canal" + "Móvil · Detalle de canal". */
@Component({
  selector: 'app-channel-detail',
  imports: [RouterLink, Poster],
  host: { class: 'flex-1 flex flex-col' },
  templateUrl: './channel-detail.html',
})
export class ChannelDetail {
  /** Route param `:id`. */
  readonly id = input(5, { transform: numberAttribute });
  readonly channel = computed(() => CHANNELS.find(c => c.id === this.id()) ?? CHANNELS[0]);

  readonly eras = CHANNEL_ERAS;
  readonly eraIndex = signal(1);
  readonly era = computed(() => CHANNEL_ERAS[this.eraIndex()]);
  readonly series = computed(() => this.era().series.map(([name, seasons]) => ({ id: seriesIdByName(name) ?? 1, name, seasons })));
  readonly upcoming = UPCOMING;
  readonly comments = CHANNEL_COMMENTS;

  share(): void { copyLink(`/canal/${this.channel().id}`); }
}

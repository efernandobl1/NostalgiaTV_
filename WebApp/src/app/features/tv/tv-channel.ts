import { Component, computed, input, numberAttribute } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CHANNELS } from '../../core/data/channels';
import { CHANNEL_ERAS, UPCOMING } from '../public/channel-detail/channel-detail.data';

/** Design: "Android TV · Detalle de canal". */
@Component({
  selector: 'app-tv-channel',
  imports: [RouterLink],
  host: { class: 'w-full h-full overflow-hidden pt-16 px-24 pb-14 flex flex-col gap-9 scan-ink-2 [--scan:0.02]' },
  template: `
    <a class="tv-focus self-start rounded-lg font-mono text-[22px] text-muted hover:text-fg no-underline" routerLink="/tv">◀ Canales</a>

    <div class="flex gap-16">
      <section class="flex-1 flex flex-col gap-5">
        <div class="flex items-center gap-8">
          <span class="w-45 h-45 flex-none rounded-[28px] flex items-center justify-center font-display font-bold text-[88px] text-ok [text-shadow:0_0_14px_rgba(139,224,143,0.45)] bg-panel-2 border-2 border-edge" aria-hidden="true">{{ channel().num }}</span>
          <div class="flex flex-col gap-2.5">
            <span class="flex items-center gap-3.5 font-mono text-[20px] tracking-[0.1em] text-amber"><span class="py-1.5 px-3 rounded-md text-on-live bg-live">● EN VIVO</span>ERA: ÉPOCA DORADA</span>
            <h1 class="m-0 font-display font-bold text-[84px] leading-none">{{ channel().name }}</h1>
          </div>
        </div>
        <p class="m-0 max-w-245 text-[26px] leading-normal text-fg-2">Caricaturas y anime de la televisión abierta, con bloques de tarde y cortes comerciales de época.</p>
        <div class="flex gap-5 mt-2">
          <a class="tv-btn tv-btn-primary tv-focus" data-autofocus [routerLink]="['/tv/ver', channel().id]">▶&nbsp; Sintonizar canal</a>
          <a class="tv-btn tv-focus" routerLink="/tv/guia">Guía del canal</a>
        </div>
      </section>

      <aside class="w-140 flex-none flex flex-col gap-1.5 p-7 rounded-[22px] bg-panel-2">
        <span class="font-display font-semibold text-[28px] mb-2">Ahora y después</span>
        @for (n of upcoming; track n.time) {
          <div class="flex gap-5 py-3.5 border-t border-line">
            <span class="w-20 font-mono text-[22px]" [style.color]="n.color">{{ n.time }}</span>
            <span class="flex flex-col gap-1"><span class="font-semibold text-[24px]">{{ n.title.replace('Los Caballeros', 'Caballeros') }}</span><span class="text-[18px] text-muted">{{ n.sub }}</span></span>
          </div>
        }
      </aside>
    </div>

    <section class="mt-auto flex flex-col gap-4.5">
      <span class="font-display font-semibold text-[30px]">Eras del canal</span>
      <div class="flex gap-5">
        @for (e of eras; track e.name) {
          <button type="button" class="tv-focus flex-1 flex flex-col items-start gap-1.5 p-6 rounded-[18px] text-left font-[inherit]"
                  [class]="e.onAir ? 'bg-amber text-on-amber border-0' : 'bg-panel-2 text-fg border-2 border-line'">
            <span class="font-mono text-[18px] opacity-85">{{ e.years }}</span>
            <span class="font-bold text-[26px]">{{ e.name }}</span>
            <span class="text-[18px] opacity-85">{{ e.series.length }} {{ e.series.length === 1 ? 'serie' : 'series' }}{{ e.onAir ? ' · al aire' : '' }}</span>
          </button>
        }
      </div>
    </section>
  `,
})
export class TvChannel {
  readonly id = input(5, { transform: numberAttribute });
  readonly channel = computed(() => CHANNELS.find(c => c.id === this.id()) ?? CHANNELS[0]);
  readonly eras = CHANNEL_ERAS;
  readonly upcoming = UPCOMING;
}

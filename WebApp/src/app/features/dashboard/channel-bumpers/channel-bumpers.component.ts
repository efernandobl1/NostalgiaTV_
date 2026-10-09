import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ChannelsService } from '../channels/channels.service';
import { ChannelErasService } from '../channel-eras/channel-eras.service';
import { BroadcastAdminService } from '../broadcast-admin.service';
import { ChannelResponse } from '../../../shared/models/channel.model';
import { ChannelEraResponse } from '../../../shared/models/channel-era.model';

@Component({
  selector: 'app-channel-bumpers',
  imports: [FormsModule, RouterLink],
  templateUrl: './channel-bumpers.component.html',
  styleUrl: './channel-bumpers.component.scss',
})
export class ChannelBumpersComponent {
  private readonly channelsService = inject(ChannelsService);
  private readonly erasService = inject(ChannelErasService);
  private readonly service = inject(BroadcastAdminService);
  private readonly route = inject(ActivatedRoute);
  readonly channels = signal<ChannelResponse[]>([]);
  readonly eras = signal<ChannelEraResponse[]>([]);
  readonly selectedEra = signal<ChannelEraResponse | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly result = signal<{ imported: number; skipped: string[] } | null>(null);
  channelId: number | null = null;
  constructor() {
    this.channelsService.getAll().subscribe({
      next: (channels) => {
        this.channels.set(channels);
        const id = Number(this.route.snapshot.queryParamMap.get('channelId'));
        if (id) {
          this.channelId = id;
          this.loadEras();
        }
      },
      error: () => this.error.set('No se pudieron cargar los canales.'),
    });
  }
  loadEras(): void {
    if (!this.channelId) return;
    this.selectedEra.set(null);
    this.eras.set([]);
    this.result.set(null);
    this.erasService.getByChannel(this.channelId).subscribe({
      next: (eras) => {
        this.eras.set(eras);
        const id = Number(this.route.snapshot.queryParamMap.get('eraId'));
        this.selectedEra.set(eras.find((era) => era.id === id) ?? eras[0] ?? null);
      },
      error: () => this.error.set('No se pudieron cargar las eras.'),
    });
  }
  import(): void {
    const era = this.selectedEra();
    if (!era || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.service.importBumpers(era.id).subscribe({
      next: (result) => {
        this.result.set(result);
        this.busy.set(false);
      },
      error: () => {
        this.busy.set(false);
        this.error.set(
          'No se pudo importar la carpeta. Comprueba sus permisos y que contenga MP4 compatibles.',
        );
      },
    });
  }
}

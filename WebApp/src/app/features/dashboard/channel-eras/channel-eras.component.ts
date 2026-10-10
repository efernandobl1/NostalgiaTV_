import { Component, OnInit, signal, computed, input, effect } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Validators } from '@angular/forms';
import { ChannelErasService } from './channel-eras.service';
import { ChannelsService } from '../channels/channels.service';
import { SeriesService } from '../series/series.service';
import { ChannelEraResponse, ChannelEraRequest } from '../../../shared/models/channel-era.model';
import { ChannelResponse } from '../../../shared/models/channel.model';
import { SeriesResponse } from '../../../shared/models/serie.model';
import { CustomizerSettingsService } from '../../../shared/components/customizer-settings/customizer-settings.service';
import {
  DialogConfig,
  GenericFormDialogComponent,
} from '../../../shared/components/dialogs/generic-form-dialog/generic-form-dialog.component';
import { DatePipe } from '@angular/common';
import { CommercialBreaksComponent } from './commercial-breaks.component';
import { MenuService } from '../../../core/services/menu.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-channel-eras',
  imports: [
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    MatTooltipModule,
    RouterLink,
    DatePipe,
    CommercialBreaksComponent,
  ],
  templateUrl: './channel-eras.component.html',
  styleUrl: './channel-eras.component.scss',
})
export class ChannelErasComponent implements OnInit {
  readonly channelId = input<number | null>(null);
  private readonly syncChannel = effect(() => {
    const id = this.channelId();
    if (id) this.onChannelChange(id);
  });
  channels = signal<ChannelResponse[]>([]);
  series = signal<SeriesResponse[]>([]);
  selectedChannelId = signal<number | null>(null);
  selectedEraId = signal<number | null>(null);
  readonly seriesPickerOpen = signal(false);
  readonly selectedSeriesIds = signal<number[]>([]);
  readonly selectedSeasons = signal<Record<number, number[]>>({});
  readonly savingSelection = signal(false);
  readonly eraTab = signal<'lineup' | 'advertising'>('lineup');
  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly activating = signal(false);
  readonly apiUrl = environment.apiUrl;
  selectedEra(): ChannelEraResponse | null {
    return this.dataSource.data.find((era) => era.id === this.selectedEraId()) ?? null;
  }
  // Nombre del canal seleccionado (para el encabezado "Eras — <canal>").
  selectedChannelName = computed(
    () => this.channels().find((c) => c.id === this.selectedChannelId())?.name ?? null,
  );
  displayedColumns = [
    'id',
    'name',
    'description',
    'startDate',
    'endDate',
    'series',
    'bumpers',
    'actions',
  ];
  dataSource = new MatTableDataSource<ChannelEraResponse>([]);

  constructor(
    private channelErasService: ChannelErasService,
    private channelsService: ChannelsService,
    private seriesService: SeriesService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    public themeService: CustomizerSettingsService,
    public menuService: MenuService,
  ) {}

  ngOnInit() {
    this.channelsService.getAll().subscribe({
      next: (data) => this.channels.set(data),
      error: () => this.showError('Error al cargar los canales'),
    });
    this.seriesService.getAll().subscribe({
      next: (data) => {
        this.series.set(data);
        const era = this.selectedEra();
        if (era) this.selectEra(era);
      },
    });
    // Deep-link desde Canales: preselecciona el canal y carga sus eras.
    const channelId = Number(this.route.snapshot.queryParamMap.get('channelId'));
    const eraId = Number(this.route.snapshot.queryParamMap.get('eraId'));
    if (Number.isSafeInteger(eraId) && eraId > 0) this.selectedEraId.set(eraId);
    if (this.route.snapshot.queryParamMap.get('section') === 'advertising')
      this.eraTab.set('advertising');
    if (channelId) {
      this.selectedChannelId.set(channelId);
      this.loadEras(channelId);
    }
  }

  onChannelChange(channelId: number) {
    this.selectedChannelId.set(channelId);
    this.loadEras(channelId);
  }

  loadEras(channelId: number) {
    this.loading.set(true);
    this.loadError.set(false);
    this.channelErasService.getByChannel(channelId).subscribe({
      next: (data) => {
        if (this.selectedChannelId() === channelId) {
          this.dataSource.data = data;
          this.loading.set(false);
          const selected = data.find((era) => era.id === this.selectedEraId()) ?? data[0];
          if (selected) this.selectEra(selected);
          else this.selectedEraId.set(null);
        }
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  selectEra(era: ChannelEraResponse): void {
    this.selectedEraId.set(era.id);
    this.seriesPickerOpen.set(false);
    this.selectedSeriesIds.set([...era.seriesIds]);
    this.selectedSeasons.set({ ...era.seasonSelections });
  }

  activate(era: ChannelEraResponse): void {
    if (this.activating()) return;
    if (!confirm(`¿Emitir la era ${era.name}? Se regenerará la programación del canal.`)) return;
    this.activating.set(true);
    this.channelErasService.activate(this.selectedChannelId()!, era.id).subscribe({
      next: () => {
        this.activating.set(false);
        this.loadEras(this.selectedChannelId()!);
        this.showSuccess('Era activada');
      },
      error: () => {
        this.activating.set(false);
        this.showError('No se pudo activar la era');
      },
    });
  }

  availableSeasons(series: SeriesResponse): number[] {
    return series.seasonNumbers ?? [];
  }

  isSeasonSelected(series: SeriesResponse, season: number): boolean {
    return (this.selectedSeasons()[series.id] ?? this.availableSeasons(series)).includes(season);
  }

  toggleSeries(seriesId: number, checked: boolean): void {
    this.selectedSeriesIds.update((ids) =>
      checked ? [...ids, seriesId] : ids.filter((id) => id !== seriesId),
    );
  }

  toggleSeason(series: SeriesResponse, season: number, checked: boolean): void {
    const current = this.selectedSeasons()[series.id] ?? this.availableSeasons(series);
    const selected = checked ? [...current, season] : current.filter((value) => value !== season);
    this.selectedSeasons.update((selections) => ({
      ...selections,
      [series.id]: [...new Set(selected)].sort((a, b) => a - b),
    }));
  }

  openForm(era?: ChannelEraResponse) {
    const channelId = this.selectedChannelId();
    if (!channelId) {
      this.showError('Seleccioná un canal primero');
      return;
    }

    const config: DialogConfig = {
      title: 'era',
      fields: [
        { key: 'name', label: 'Nombre', type: 'text', validators: [Validators.required] },
        { key: 'description', label: 'Descripción', type: 'textarea' },
        {
          key: 'startDate',
          label: 'Fecha de inicio',
          type: 'datepicker',
          validators: [Validators.required],
        },
        { key: 'endDate', label: 'Fecha de fin', type: 'datepicker' },
      ],
      data: era ? { ...era } : null,
    };

    const dialogRef = this.dialog.open(GenericFormDialogComponent, {
      width: '500px',
      data: config,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;

      if (era) {
        this.channelErasService
          .update(channelId, era.id, result.data as ChannelEraRequest)
          .subscribe({
            next: () => {
              this.loadEras(channelId);
              this.showSuccess('Era actualizada');
            },
            error: () => this.showError('Error al actualizar la era'),
          });
      } else {
        this.channelErasService.create(channelId, result.data as ChannelEraRequest).subscribe({
          next: () => {
            this.loadEras(channelId);
            this.showSuccess('Era creada');
          },
          error: () => this.showError('Error al crear la era'),
        });
      }
    });
  }

  // Los bumpers son propios de cada era: se gestionan desde la fila de la era.
  manageBumpers(era: ChannelEraResponse) {
    this.router.navigate(['/dashboard/channel-bumpers'], {
      queryParams: { channelId: this.selectedChannelId(), eraId: era.id },
    });
  }

  assignSeries(era: ChannelEraResponse) {
    this.selectEra(era);
    this.seriesPickerOpen.set(true);
  }

  saveSeriesSelection(era: ChannelEraResponse): void {
    if (this.savingSelection()) return;
    const seriesIds = this.selectedSeriesIds();
    for (const series of this.series().filter((item) => seriesIds.includes(item.id))) {
      if ((this.selectedSeasons()[series.id] ?? this.availableSeasons(series)).length === 0) {
        this.showError(`Elige al menos una temporada de ${series.name} o quita la serie`);
        return;
      }
    }
    this.savingSelection.set(true);
    this.channelErasService
      .assignSeries(this.selectedChannelId()!, era.id, {
        seriesIds,
        seasonSelections: this.selectedSeasons(),
      })
      .subscribe({
        next: () => {
          this.savingSelection.set(false);
          this.seriesPickerOpen.set(false);
          this.loadEras(this.selectedChannelId()!);
          this.showSuccess('Series y temporadas guardadas');
        },
        error: () => {
          this.savingSelection.set(false);
          this.showError('Error al guardar las series y temporadas');
        },
      });
  }

  deleteEra(era: ChannelEraResponse) {
    if (!confirm(`¿Eliminar la era ${era.name}?`)) return;
    this.channelErasService.delete(this.selectedChannelId()!, era.id).subscribe({
      next: () => {
        this.loadEras(this.selectedChannelId()!);
        this.showSuccess('Era eliminada');
      },
      error: () => this.showError('Error al eliminar la era'),
    });
  }

  getSeriesNames(seriesIds: number[]) {
    return seriesIds.map((id) => this.series().find((s) => s.id === id)?.name ?? id).join(', ');
  }
  eraSeries(seriesIds: number[]): SeriesResponse[] {
    return this.series().filter((item) => seriesIds.includes(item.id));
  }

  private showSuccess(msg: string) {
    this.snackBar.open(msg, 'Cerrar', { duration: 5000 });
  }
  private showError(msg: string) {
    this.snackBar.open(msg, 'Cerrar', {
      duration: 0,
      panelClass: 'error-snack',
      politeness: 'assertive',
    });
  }
}

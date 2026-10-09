import { ChannelErasComponent } from '../channel-eras/channel-eras.component';
import { Component, OnInit, signal, ViewChild, computed, inject } from '@angular/core';
import { ChannelPackageComponent } from './channel-package.component';
import { MenuService } from '../../../core/services/menu.service';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { Validators } from '@angular/forms';
import { ChannelsService } from './channels.service';
import { ChannelResponse } from '../../../shared/models/channel.model';
import { CustomizerSettingsService } from '../../../shared/components/customizer-settings/customizer-settings.service';
import {
  DialogConfig,
  GenericFormDialogComponent,
} from '../../../shared/components/dialogs/generic-form-dialog/generic-form-dialog.component';
import { DatePipe } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, of } from 'rxjs';

interface ChannelStatePreview {
  episodeTitle?: string;
  nextEpisodeTitle?: string;
}

interface ScheduleEntry {
  contentKind?: 'Episode' | 'Bumper' | 'Advertisement';
  mediaStartSecond?: number;
  id: number;
  channelId: number;
  episodeId?: number;
  episodeTitle: string;
  seriesName: string;
  seriesLogoPath?: string;
  filePath: string;
  startTime: string;
  endTime: string;
  season: number;
  episodeNumber: number;
  bumperId?: number;
  bumperTitle?: string;
}

@Component({
  selector: 'app-channels',
  imports: [
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatCardModule,
    MatTooltipModule,
    DatePipe,
    ChannelErasComponent,
    ChannelPackageComponent,
  ],
  templateUrl: './channels.component.html',
  styleUrl: './channels.component.scss',
})
export class ChannelsComponent implements OnInit {
  readonly selectedChannel = signal<ChannelResponse | null>(null);
  readonly detailTab = signal<'eras' | 'schedule' | 'history' | 'share'>('eras');
  private readonly menu = inject(MenuService);
  readonly isAdmin = computed(() => this.menu.currentUser()?.rol.id === 1);
  readonly importing = signal(false);
  onImported(channelId: number): void {
    this.importing.set(false);
    this.router
      .navigate([], { relativeTo: this.route, queryParams: { channelId } })
      .then(() => this.loadChannels());
    this.showSuccess(
      'Canal instalado. Revisa sus piezas y regenera la programación para emitirlo.',
    );
  }
  readonly searchTerm = signal('');
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly schedule = signal<ScheduleEntry[]>([]);
  readonly scheduleLoading = signal(false);
  readonly scheduleError = signal(false);
  readonly refreshing = signal(false);
  readonly showPast = signal(false);
  readonly channelStates = signal<Record<number, ChannelStatePreview | null>>({});
  paginator!: MatPaginator;
  @ViewChild(MatPaginator) set page(value: MatPaginator) {
    if (value) {
      this.paginator = value;
      this.dataSource.paginator = value;
    }
  }

  displayedColumns = ['id', 'name', 'logo', 'history', 'startDate', 'endDate', 'actions'];
  dataSource = new MatTableDataSource<ChannelResponse>([]);
  apiUrl = environment.apiUrl;

  constructor(
    private channelsService: ChannelsService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    public themeService: CustomizerSettingsService,
  ) {}

  // Las eras son propias de cada canal: en vez de un menú suelto, se gestionan
  // desde la fila del canal (deep-link con el canal preseleccionado).
  manageEras(channel: ChannelResponse) {
    this.router.navigate(['/dashboard/channel-eras'], { queryParams: { channelId: channel.id } });
  }

  ngOnInit() {
    this.loadChannels();
    if (this.route.snapshot.queryParamMap.get('new') === '1') {
      queueMicrotask(() => this.openForm());
    }
  }

  loadChannels() {
    this.loading.set(true);
    this.loadError.set(false);
    this.channelsService.getAll().subscribe({
      next: (data) => {
        this.dataSource.data = data;
        this.loading.set(false);
        const selectedId =
          this.selectedChannel()?.id ?? Number(this.route.snapshot.queryParamMap.get('channelId'));
        this.selectedChannel.set(data.find((channel) => channel.id === selectedId) ?? null);
        for (const channel of data) {
          this.http
            .get<ChannelStatePreview>(`${this.apiUrl}/api/v1/public/channels/${channel.id}/state`)
            .pipe(catchError(() => of(null)))
            .subscribe((state) =>
              this.channelStates.update((states) => ({ ...states, [channel.id]: state })),
            );
        }
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  openForm(channel?: ChannelResponse) {
    const config: DialogConfig = {
      title: 'canal',
      fields: [
        { key: 'name', label: 'Nombre', type: 'text', validators: [Validators.required] },
        { key: 'logo', label: 'Logo', type: 'file' },
        { key: 'history', label: 'Historia', type: 'textarea' },
        {
          key: 'startDate',
          label: 'Fecha de inicio',
          type: 'datepicker',
          validators: [Validators.required],
        },
        { key: 'endDate', label: 'Fecha de fin', type: 'datepicker' },
      ],
      data: channel ? { ...channel, logo: environment.apiUrl + channel.logoPath } : null,
    };

    const dialogRef = this.dialog.open(GenericFormDialogComponent, {
      width: '500px',
      data: config,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;

      let payload: FormData;
      if (result.isMultipart) {
        payload = result.formData;
      } else {
        payload = new FormData();
        const data = result.data;
        Object.keys(data).forEach((key) => {
          if (data[key] !== null && data[key] !== undefined && data[key] !== '')
            payload.append(key, data[key]);
        });
      }

      if (channel) {
        this.channelsService.update(channel.id, payload).subscribe({
          next: (updated) => {
            this.dataSource.data = this.dataSource.data.map((c) =>
              c.id === updated.id ? updated : c,
            );
            this.showSuccess('Canal actualizado');
            this.selectedChannel.set(updated);
          },
          error: () => this.showError('Error al actualizar el canal'),
        });
      } else {
        this.channelsService.create(payload).subscribe({
          next: (created) => {
            this.dataSource.data = [...this.dataSource.data, created];
            this.selectedChannel.set(created);
            this.showSuccess('Canal creado');
          },
          error: () => this.showError('Error al crear el canal'),
        });
      }
    });
  }

  selectChannel(channel: ChannelResponse): void {
    this.selectedChannel.set(channel);
    this.detailTab.set('eras');
    this.router.navigate([], { queryParams: { channelId: channel.id }, replaceUrl: true });
  }
  backToChannels(): void {
    this.selectedChannel.set(null);
    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  visibleChannels(): ChannelResponse[] {
    return this.dataSource.data.filter((channel) =>
      channel.name.toLocaleLowerCase().includes(this.searchTerm().toLocaleLowerCase()),
    );
  }

  visibleSchedule(): ScheduleEntry[] {
    return this.showPast()
      ? this.schedule()
      : this.schedule().filter((entry) => new Date(entry.endTime).getTime() > Date.now());
  }

  mediaTime(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  }

  viewSchedule(channel: ChannelResponse) {
    this.detailTab.set('schedule');
    this.scheduleLoading.set(true);
    this.scheduleError.set(false);
    this.schedule.set([]);
    this.http
      .get<ScheduleEntry[]>(`${this.apiUrl}/api/v1/public/channels/${channel.id}/schedule`)
      .subscribe({
        next: (entries) => {
          if (this.selectedChannel()?.id !== channel.id) return;
          this.schedule.set(entries);
          this.scheduleLoading.set(false);
        },
        error: () => {
          this.scheduleLoading.set(false);
          this.scheduleError.set(true);
        },
      });
  }

  refreshSchedule(channel: ChannelResponse) {
    if (this.refreshing()) return;
    if (
      !confirm(
        `¿Regenerar la programación de ${channel.name}? El episodio actual continuará hasta terminar.`,
      )
    )
      return;
    this.refreshing.set(true);
    this.http.post(`${this.apiUrl}/api/v1/channels/${channel.id}/schedule/refresh`, {}).subscribe({
      next: () => {
        this.refreshing.set(false);
        this.showSuccess('Programación regenerada');
        this.viewSchedule(channel);
      },
      error: () => {
        this.refreshing.set(false);
        this.showError('Error al regenerar la programación');
      },
    });
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

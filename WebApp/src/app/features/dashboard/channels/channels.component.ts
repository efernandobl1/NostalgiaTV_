import { Component, OnInit, signal, ViewChild, AfterViewInit, Inject } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
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
import { DatePipe, CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';

interface ScheduleEntry {
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
  selector: 'app-schedule-dialog',
  standalone: true,
  imports: [CommonModule, DatePipe, MatButtonModule, MatIconModule, MatDialogModule, MatCardModule],
  template: `
    <div class="dialog-header">
      <h2>{{ config.title }}</h2>
      <button mat-icon-button (click)="close()"><mat-icon>close</mat-icon></button>
    </div>
    <div class="dialog-body">
      @if (entries.length === 0) {
        <p class="empty-msg">No schedule entries found.</p>
      } @else {
        @for (entry of entries; track entry.id) {
          <div class="schedule-item">
            <div class="time-col">
              <div class="time-start">{{ toLocalTime(entry.startTime) | date:'HH:mm' }}</div>
              <div class="time-end">{{ toLocalTime(entry.endTime) | date:'HH:mm' }}</div>
            </div>
            <div class="info-col">
              <div class="series-name">{{ entry.seriesName }}</div>
              <div class="ep-title">{{ entry.episodeTitle }}
                @if (entry.season > 0) { · T{{ entry.season }} }
                @if (entry.episodeNumber > 0) { EP{{ entry.episodeNumber }} }
              </div>
            </div>
            @if (entry.seriesLogoPath) {
              <img [src]="apiUrl + entry.seriesLogoPath" class="series-logo" />
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    :host { display:block; }
    .dialog-header {
      display:flex; justify-content:space-between; align-items:center;
      padding:16px 24px; border-bottom:1px solid var(--mat-sys-outline-variant, rgba(0,0,0,0.12));
    }
    .dialog-header h2 { margin:0; font-size:18px; }
    .dialog-body { padding:16px 24px; max-height:60vh; overflow-y:auto; }
    .empty-msg { text-align:center; opacity:0.6; }
    .schedule-item {
      display:flex; align-items:center; gap:12px;
      padding:10px 0; border-bottom:1px solid var(--mat-sys-outline-variant, rgba(0,0,0,0.08));
    }
    .time-col { min-width:100px; }
    .time-start { font-weight:bold; font-size:14px; }
    .time-end { font-size:12px; opacity:0.6; }
    .info-col { flex:1; }
    .series-name { font-weight:500; }
    .ep-title { font-size:12px; opacity:0.6; }
    .series-logo { height:32px; border-radius:4px; }
  `],
})
export class ScheduleDialogComponent {
  entries: ScheduleEntry[] = [];
  apiUrl = environment.apiUrl;

  constructor(
    @Inject(MAT_DIALOG_DATA) public config: DialogConfig,
    private dialogRef: MatDialogRef<ScheduleDialogComponent>,
  ) {
    this.entries = config.data?.['entries'] ?? [];
  }

  toLocalTime(utc: string): Date {
    return new Date(utc);
  }

  close() {
    this.dialogRef.close();
  }
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
    DatePipe,
    ScheduleDialogComponent,
  ],
  templateUrl: './channels.component.html',
  styleUrl: './channels.component.scss',
})
export class ChannelsComponent implements OnInit, AfterViewInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  displayedColumns = ['id', 'name', 'logo', 'history', 'startDate', 'endDate', 'actions'];
  dataSource = new MatTableDataSource<ChannelResponse>([]);
  apiUrl = environment.apiUrl;

  constructor(
    private channelsService: ChannelsService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private http: HttpClient,
    public themeService: CustomizerSettingsService,
  ) {}

  ngOnInit() {
    this.loadChannels();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
  }

  loadChannels() {
    this.channelsService.getAll().subscribe({
      next: (data) => (this.dataSource.data = data),
      error: () => this.showError('Error loading channels'),
    });
  }

  openForm(channel?: ChannelResponse) {
    const config: DialogConfig = {
      title: 'Channel',
      fields: [
        { key: 'name', label: 'Name', type: 'text', validators: [Validators.required] },
        { key: 'logo', label: 'Logo', type: 'file' },
        { key: 'history', label: 'History', type: 'textarea' },
        {
          key: 'startDate',
          label: 'Start Date',
          type: 'datepicker',
          validators: [Validators.required],
        },
        { key: 'endDate', label: 'End Date', type: 'datepicker' },
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
            this.showSuccess('Channel updated');
          },
          error: () => this.showError('Error updating channel'),
        });
      } else {
        this.channelsService.create(payload).subscribe({
          next: (created) => {
            this.dataSource.data = [...this.dataSource.data, created];
            this.showSuccess('Channel created');
          },
          error: () => this.showError('Error creating channel'),
        });
      }
    });
  }

  viewSchedule(channel: ChannelResponse) {
    this.http.get<ScheduleEntry[]>(`${this.apiUrl}/api/v1/public/channels/${channel.id}/schedule`).subscribe({
      next: (entries) => {
        const seen = new Set<string>();
        const unique = entries.filter(e => {
          const key = `${e.episodeId}-${e.startTime}-${e.bumperId ?? 0}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const config: DialogConfig = {
          title: `Schedule — ${channel.name}`,
          fields: [],
          data: { entries: unique },
        };
        this.dialog.open(ScheduleDialogComponent, {
          width: '700px',
          maxWidth: '95vw',
          data: config,
        });
      },
      error: () => this.showError('Error loading schedule'),
    });
  }

  refreshSchedule(channel: ChannelResponse) {
    this.http.post(`${this.apiUrl}/api/v1/channels/${channel.id}/schedule/refresh`, {}).subscribe({
      next: () => {
        this.showSuccess('Schedule refresh started');
        setTimeout(() => this.viewSchedule(channel), 3000);
      },
      error: () => this.showError('Error refreshing schedule'),
    });
  }

  private showSuccess(msg: string) {
    this.snackBar.open(msg, 'Close', { duration: 3000 });
  }
  private showError(msg: string) {
    this.snackBar.open(msg, 'Close', { duration: 3000, panelClass: 'error-snack' });
  }
}

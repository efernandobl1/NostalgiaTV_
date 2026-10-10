import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PublicSettings {
  seasonalThemesEnabled: boolean;
  seasonalEffectsEnabled: boolean;
  timeZoneId: string;
}

export interface PlatformSettings extends PublicSettings {
  publicRegistrationEnabled: boolean;
  seasonalEpisodesEnabled: boolean;
  seasonalInterludesEnabled: boolean;
  noRepeatWindowHours: number;
  maxSpecialsPerSeriesPerDay: number;
  maxSpecialsPerDay: number;
  maxMoviesPerSeriesPerDay: number;
  maxMoviesPerDay: number;
}

@Injectable({ providedIn: 'root' })
export class PlatformSettingsService {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly url = `${environment.apiUrl}/api/v1/settings`;
  private refreshing = false;
  readonly publicSettings = signal<PublicSettings>({
    seasonalThemesEnabled: true,
    seasonalEffectsEnabled: true,
    timeZoneId: 'America/Guatemala',
  });

  load() { return this.http.get<PlatformSettings>(this.url, { withCredentials: true }); }
  save(settings: PlatformSettings) {
    return this.http.put<PlatformSettings>(this.url, settings, { withCredentials: true }).pipe(tap(saved => {
      this.publicSettings.set(this.publicValues(saved));
    }));
  }
  refreshPublic(): void {
    if (this.refreshing) return;
    this.refreshing = true;
    this.http.get<PublicSettings>(`${environment.apiUrl}/api/v1/public/settings`).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.refreshing = false),
    ).subscribe({
      next: settings => this.publicSettings.set(this.publicValues(settings)),
      error: () => { /* Keep the last known policy during a temporary outage. */ },
    });
  }
  private publicValues(settings: PublicSettings): PublicSettings {
    return {
      seasonalThemesEnabled: settings.seasonalThemesEnabled,
      seasonalEffectsEnabled: settings.seasonalEffectsEnabled,
      timeZoneId: settings.timeZoneId,
    };
  }
}

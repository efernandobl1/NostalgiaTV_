import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface PackagePreview {
  manifest: {
    name: string;
    schedulingMode: string;
    excludedClips: number;
    eras: {
      key: string;
      name: string;
      series: { seriesKey: string; hasSeasonFilter: boolean; seasons: number[] }[];
    }[];
    clips: { key: string; title: string; kind: number; season: 0 | 1 | 2; license: string }[];
  };
  fingerprint: string;
  alreadyInstalled: boolean;
  downloadBytes: number;
  series: { key: string; name: string; existingId: number | null; availableEpisodes: number }[];
}
export interface PackageImportResult {
  channelId: number;
  newSeries: number;
  reusedSeries: number;
  importedClips: number;
}

@Injectable({ providedIn: 'root' })
export class ChannelPackagesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/v1/channel-packages`;
  private readonly options = { withCredentials: true };

  catalogConfiguration() {
    return this.http.get<{ publicUrl: string | null }>(
      `${environment.apiUrl}/api/v1/community-catalog`,
      this.options,
    );
  }

  preview(file: File) {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<PackagePreview>(`${this.base}/preview`, body, this.options);
  }
  install(file: File, fingerprint: string) {
    const body = new FormData();
    body.append('file', file);
    body.append('fingerprint', fingerprint);
    return this.http.post<PackageImportResult>(`${this.base}/import`, body, this.options);
  }
  export(
    channelId: number,
    includeMedia: boolean,
    rightsConfirmed: boolean,
    sharingPermission?: string,
  ) {
    return this.http.post(
      `${this.base}/export/${channelId}`,
      { includeMedia, rightsConfirmed, ...(sharingPermission ? { sharingPermission } : {}) },
      { ...this.options, responseType: 'blob' },
    );
  }
}

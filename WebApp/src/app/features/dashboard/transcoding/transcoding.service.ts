import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export type WorkerId = 'transcode' | 'index';
export interface MediaWorker { id: WorkerId; enabled: boolean; heartbeatUtc: string | null; }
export interface MediaJob {
  id: number; worker: WorkerId; status: string; progress: number; sourcePath: string;
  outputPath: string | null; sourceSize: number; message: string | null; updatedAtUtc: string; seriesName: string;
}
export interface MediaStatus {
  heartbeatToleranceSeconds?: number;
  workers: MediaWorker[];
  counts: { worker: WorkerId; status: string; count: number }[];
  jobs: MediaJob[];
}

@Injectable({ providedIn: 'root' })
export class TranscodingService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/v1/transcoding`;
  getStatus() { return this.http.get<MediaStatus>(this.url, { withCredentials: true }); }
  setEnabled(worker: WorkerId, enabled: boolean) {
    return this.http.put(`${this.url}/workers/${worker}`, { enabled }, { withCredentials: true });
  }
  retry(id: number) { return this.http.post(`${this.url}/jobs/${id}/retry`, {}, { withCredentials: true }); }
}

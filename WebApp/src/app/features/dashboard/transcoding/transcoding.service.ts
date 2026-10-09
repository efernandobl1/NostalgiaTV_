import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export type WorkerId = 'transcode' | 'index';
export type JobView = 'pending' | 'Completed' | 'Skipped' | 'Failed' | 'all';
export interface JobQuery { worker: WorkerId | 'all'; view: JobView; page: number; pageSize: number; }
export interface ResourcePolicy {
  dayCores: number; nightCores: number; nightEnabled: boolean; nightStartMinute: number; nightEndMinute: number;
  timeZoneId: string; availableCores: number; appliedCores: number; appliedAtUtc: string | null;
}
export interface MediaWorker { id: WorkerId; enabled: boolean; heartbeatUtc: string | null; }
export interface MediaJob {
  id: number; worker: WorkerId; status: string; progress: number; sourcePath: string;
  outputPath: string | null; sourceSize: number; message: string | null; updatedAtUtc: string; seriesName: string;
}
export interface MediaStatus {
  resourcePolicy?: ResourcePolicy;
  heartbeatToleranceSeconds?: number;
  workers: MediaWorker[];
  counts: { worker: WorkerId; status: string; count: number }[];
  jobs: MediaJob[];
  jobsTotal: number;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class TranscodingService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/v1/transcoding`;
  getStatus(query: JobQuery) { return this.http.get<MediaStatus>(this.url, { params: { ...query }, withCredentials: true }); }
  setEnabled(worker: WorkerId, enabled: boolean) {
    return this.http.put(`${this.url}/workers/${worker}`, { enabled }, { withCredentials: true });
  }
  retry(id: number) { return this.http.post(`${this.url}/jobs/${id}/retry`, {}, { withCredentials: true }); }
  saveResources(policy: ResourcePolicy) { return this.http.put(`${this.url}/resources`, policy, { withCredentials: true }); }
}

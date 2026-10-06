import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Interlude {
  id: number;
  title: string;
  kind: 0 | 1;
  filePath: string;
  durationSeconds: number;
  originalYearFrom: number | null;
  originalYearTo: number | null;
  regionCode: string | null;
  approvedForBroadcast: boolean;
}
export interface ClipAssignment {
  channelEraId: number;
  interludeId: number;
  role: 0 | 1 | 2;
  weight: number;
  minimumGapSeconds: number;
}
export interface BreakRules {
  minimumAds: number;
  maximumAds: number;
  maximumBreakSeconds: number;
}
export interface BreakPoint {
  id: number;
  episodeId: number;
  offsetSeconds: number;
  label?: string;
}
export interface ModeratedComment {
  id: number;
  seriesId: number;
  seriesName: string;
  author: string;
  parentCommentId?: number;
  body: string;
  status: string;
  createdAtUtc: string;
}
export interface MetadataProvider {
  id: number;
  code: string;
  name: string;
}
export interface ExternalId {
  id: number;
  seriesId: number;
  providerId: number;
  externalId: string;
}
export interface ImportRun {
  id: number;
  status: string;
  startedAtUtc: string;
  finishedAtUtc?: string;
}

@Injectable({ providedIn: 'root' })
export class BroadcastAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/v1`;
  private readonly options = { withCredentials: true };
  getInterludes() {
    return this.http.get<Interlude[]>(`${this.base}/retro/interludes`, this.options);
  }
  importBumpers(eraId: number) {
    return this.http.post<{ imported: number; skipped: string[] }>(
      `${this.base}/retro/eras/${eraId}/import-bumpers`,
      {},
      this.options,
    );
  }
  uploadInterlude(body: FormData) {
    return this.http.post<Interlude>(`${this.base}/retro/interludes`, body, this.options);
  }
  updateInterlude(clip: Interlude) {
    return this.http.put<Interlude>(`${this.base}/retro/interludes/${clip.id}`, clip, this.options);
  }
  deleteInterlude(id: number) {
    return this.http.delete(`${this.base}/retro/interludes/${id}`, this.options);
  }
  approve(id: number, approved: boolean) {
    return this.http.put(
      `${this.base}/retro/interludes/${id}/approval`,
      { approved },
      this.options,
    );
  }
  getAssignments(eraId: number) {
    return this.http.get<ClipAssignment[]>(
      `${this.base}/retro/eras/${eraId}/interludes`,
      this.options,
    );
  }
  assign(eraId: number, clipId: number, role: number, weight: number, minimumGapSeconds: number) {
    return this.http.put<ClipAssignment>(
      `${this.base}/retro/eras/${eraId}/interludes/${clipId}/${role}`,
      { weight, minimumGapSeconds },
      this.options,
    );
  }
  remove(eraId: number, clipId: number, role: number) {
    return this.http.delete(
      `${this.base}/retro/eras/${eraId}/interludes/${clipId}/${role}`,
      this.options,
    );
  }
  getRules(eraId: number) {
    return this.http.get<BreakRules>(`${this.base}/retro/eras/${eraId}/break-rules`, this.options);
  }
  setRules(eraId: number, rules: BreakRules) {
    return this.http.put<BreakRules>(
      `${this.base}/retro/eras/${eraId}/break-rules`,
      rules,
      this.options,
    );
  }
  disableRules(eraId: number) {
    return this.http.delete(`${this.base}/retro/eras/${eraId}/break-rules`, this.options);
  }
  getBreakPoints(episodeId: number) {
    return this.http.get<BreakPoint[]>(
      `${this.base}/retro/episodes/${episodeId}/break-points`,
      this.options,
    );
  }
  addBreakPoint(episodeId: number, offsetSeconds: number, label: string) {
    return this.http.post<BreakPoint>(
      `${this.base}/retro/episodes/${episodeId}/break-points`,
      { offsetSeconds, label },
      this.options,
    );
  }
  deleteBreakPoint(episodeId: number, pointId: number) {
    return this.http.delete(
      `${this.base}/retro/episodes/${episodeId}/break-points/${pointId}`,
      this.options,
    );
  }
  comments(status: string, page: number, seriesId?: number | null) {
    return this.http.get<{ items: ModeratedComment[]; totalCount: number }>(
      `${this.base}/moderation/comments`,
      { ...this.options, params: { status, page, ...(seriesId ? { seriesId } : {}) } },
    );
  }
  moderate(comment: ModeratedComment, status: string) {
    return this.http.put(
      `${this.base}/series/${comment.seriesId}/comments/${comment.id}/moderation`,
      { status },
      this.options,
    );
  }
  providers() {
    return this.http.get<MetadataProvider[]>(`${this.base}/metadata/providers`, this.options);
  }
  addProvider(code: string, name: string) {
    return this.http.post<MetadataProvider>(
      `${this.base}/metadata/providers`,
      { code, name },
      this.options,
    );
  }
  externalIds(seriesId: number) {
    return this.http.get<ExternalId[]>(
      `${this.base}/metadata/series/${seriesId}/external-ids`,
      this.options,
    );
  }
  linkExternalId(seriesId: number, providerId: number, externalId: string) {
    return this.http.put<ExternalId>(
      `${this.base}/metadata/series/${seriesId}/external-ids/${providerId}`,
      { externalId },
      this.options,
    );
  }
  imports(seriesId: number) {
    return this.http.get<ImportRun[]>(
      `${this.base}/metadata/series/${seriesId}/imports`,
      this.options,
    );
  }
}

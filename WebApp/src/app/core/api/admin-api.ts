import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { filter, map, Observable } from 'rxjs';
import { Api } from './api';
import * as M from './models';

export interface ChannelForm { name: string; history: string | null; startDate: string; endDate: string | null }
export interface EraForm { name: string; description: string | null; historicalStartDate: string; historicalEndDate: string | null }
export interface SeriesForm { name: string; description: string | null; history: string | null; rating: number | null; startDate: string; endDate: string | null; categoryIds: number[]; initialSeasons?: number }
export interface EpisodeForm { title: string; seasonNumber: number; episodeNumber: number; episodeTypeId: number; episodePart: string | null }
export interface InterludeForm {
  title: string | null; kind: string; bumperType: string | null; season: string; redistributionAllowed: boolean;
  license: string | null; sourceUrl: string | null; regionCode: string | null; originalYearFrom: number | null; originalYearTo: number | null;
}
export interface ResourceForm { dayCores: number; nightCores: number; nightEnabled: boolean; nightStartMinute: number; nightEndMinute: number }
export interface ClearQueueForm { confirmation: string; statuses: string[]; seriesId?: number | null; worker?: string | null; olderThanDays?: number | null }
export type PlatformSettingsForm = Omit<M.PlatformSettings, never>;

/** Upload progress (0–100) followed by the final response. */
export type UploadEvent<T> = { progress: number; result?: T };

/** Builds a multipart body; null/undefined fields are left out, arrays repeat the key. */
function form(fields: object, files: Record<string, File | File[] | null | undefined> = {}): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === '') continue;
    const name = key.charAt(0).toUpperCase() + key.slice(1);
    if (Array.isArray(value)) value.forEach(item => data.append(name, String(item)));
    else data.append(name, String(value));
  }
  for (const [key, value] of Object.entries(files)) {
    if (!value) continue;
    (Array.isArray(value) ? value : [value]).forEach(file => data.append(key, file, file.name));
  }
  return data;
}

/** Typed client of the /api/v1/admin endpoints (dashboard). */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly api = inject(Api);
  private readonly http = inject(HttpClient);

  private upload<T>(path: string, body: FormData): Observable<UploadEvent<T>> {
    return this.http.post<T>(`/api/v1${path}`, body, { reportProgress: true, observe: 'events' }).pipe(
      filter((event: HttpEvent<T>) => event.type === HttpEventType.UploadProgress || event.type === HttpEventType.Response),
      map(event => event.type === HttpEventType.Response
        ? { progress: 100, result: event.body as T }
        : { progress: event.type === HttpEventType.UploadProgress && event.total ? Math.round(event.loaded * 100 / event.total) : 0 }),
    );
  }

  // ── Resumen ──
  summary() { return this.api.get<M.DashboardSummary>('/admin/summary'); }
  activity(days = 7, page = 1, pageSize = 50) { return this.api.get<M.Paged<M.ActivityItem>>('/admin/activity', { days, page, pageSize }); }

  // ── Programación ──
  programs(channelId: number, from?: string, to?: string) { return this.api.get<M.ScheduleProgram[]>(`/admin/schedule/channels/${channelId}/programs`, { from, to }); }
  guide(day: string, channelId?: number) { return this.api.get<M.GuideRow[]>('/admin/schedule/guide', { day, channelId }); }
  regenerate(channelId: number) { return this.api.post<void>(`/admin/schedule/channels/${channelId}/regenerate`); }

  // ── Canales ──
  channels() { return this.api.get<M.ChannelListItem[]>('/admin/channels'); }
  channel(id: number) { return this.api.get<M.ChannelDetail>(`/admin/channels/${id}`); }
  createChannel(value: ChannelForm, logo?: File | null) { return this.api.post<M.ChannelDetail>('/admin/channels', form(value, { logo })); }
  updateChannel(id: number, value: ChannelForm, logo?: File | null) { return this.api.put<M.ChannelDetail>(`/admin/channels/${id}`, form(value, { logo })); }
  deleteChannel(id: number) { return this.api.delete(`/admin/channels/${id}`); }
  createEra(channelId: number, value: EraForm) { return this.api.post<M.EraItem>(`/admin/channels/${channelId}/eras`, value); }
  updateEra(channelId: number, eraId: number, value: EraForm) { return this.api.put<M.EraItem>(`/admin/channels/${channelId}/eras/${eraId}`, value); }
  deleteEra(channelId: number, eraId: number) { return this.api.delete(`/admin/channels/${channelId}/eras/${eraId}`); }
  activateEra(channelId: number, eraId: number) { return this.api.post<void>(`/admin/channels/${channelId}/eras/${eraId}/activate`); }
  eraSeries(channelId: number, eraId: number) { return this.api.get<M.EraSeriesItem[]>(`/admin/channels/${channelId}/eras/${eraId}/series`); }
  setEraSeries(channelId: number, eraId: number, series: { seriesId: number; seasons: number[] | null }[]) {
    return this.api.put<M.EraSeriesItem[]>(`/admin/channels/${channelId}/eras/${eraId}/series`, { series });
  }
  breakRule(channelId: number, eraId: number) { return this.api.get<M.BreakRule | null>(`/admin/channels/${channelId}/eras/${eraId}/break-rule`); }
  setBreakRule(channelId: number, eraId: number, rule: M.BreakRule) { return this.api.put<M.BreakRule>(`/admin/channels/${channelId}/eras/${eraId}/break-rule`, rule); }
  removeBreakRule(channelId: number, eraId: number) { return this.api.delete(`/admin/channels/${channelId}/eras/${eraId}/break-rule`); }
  eraInterludes(channelId: number, eraId: number) { return this.api.get<M.EraInterludeItem[]>(`/admin/channels/${channelId}/eras/${eraId}/interludes`); }
  assignInterlude(channelId: number, eraId: number, interludeId: number, seriesId: number | null, weight: number, minimumGapSeconds: number) {
    const query = seriesId ? `?seriesId=${seriesId}` : '';
    return this.api.put<M.EraInterludeItem>(`/admin/channels/${channelId}/eras/${eraId}/interludes/${interludeId}${query}`, { weight, minimumGapSeconds });
  }
  scanEraInterludes(channelId: number, eraId: number) { return this.api.post<M.EraFolderScan>(`/admin/channels/${channelId}/eras/${eraId}/interludes/scan`); }
  removeInterlude(channelId: number, eraId: number, interludeId: number, seriesId: number | null) {
    const query = seriesId ? `?seriesId=${seriesId}` : '';
    return this.api.delete(`/admin/channels/${channelId}/eras/${eraId}/interludes/${interludeId}${query}`);
  }

  // ── Series ──
  series(search?: string) { return this.api.get<M.SeriesListItem[]>('/admin/series', { search }); }
  seriesDetail(id: number) { return this.api.get<M.SeriesDetail>(`/admin/series/${id}`); }
  createSeries(value: SeriesForm, logo?: File | null) { return this.api.post<M.SeriesDetail>('/admin/series', form(value, { logo })); }
  updateSeries(id: number, value: SeriesForm, logo?: File | null) { return this.api.put<M.SeriesDetail>(`/admin/series/${id}`, form(value, { logo })); }
  deleteSeries(id: number) { return this.api.delete(`/admin/series/${id}`); }
  setCategories(id: number, categoryIds: number[]) { return this.api.put<M.SeriesDetail>(`/admin/series/${id}/categories`, { categoryIds }); }
  addSeason(id: number, seasonNumber: number) { return this.api.post<M.SeriesDetail>(`/admin/series/${id}/seasons`, { seasonNumber }); }
  removeSeason(id: number, season: number) { return this.api.delete<M.SeriesDetail>(`/admin/series/${id}/seasons/${season}`); }
  episodes(id: number, season?: number) { return this.api.get<M.EpisodeItem[]>(`/admin/series/${id}/episodes`, { season }); }
  uploadEpisodes(id: number, target: 'season' | 'specials' | 'movies', season: number | null, files: File[]) {
    return this.upload<M.EpisodeUploadResult[]>(`/admin/series/${id}/episodes/upload`, form({ target, season }, { files }));
  }
  scan(id: number) { return this.api.post<M.ScanResult>(`/admin/series/${id}/scan`); }
  updateEpisode(episodeId: number, value: EpisodeForm) { return this.api.put<M.EpisodeItem>(`/admin/series/episodes/${episodeId}`, value); }
  deleteEpisode(episodeId: number) { return this.api.delete(`/admin/series/episodes/${episodeId}`); }
  breakPoints(episodeId: number) { return this.api.get<M.BreakPointItem[]>(`/admin/series/episodes/${episodeId}/break-points`); }
  addBreakPoint(episodeId: number, offsetSeconds: number, label: string | null) {
    return this.api.post<M.BreakPointItem>(`/admin/series/episodes/${episodeId}/break-points`, { offsetSeconds, label });
  }
  deleteBreakPoint(episodeId: number, id: number) { return this.api.delete(`/admin/series/episodes/${episodeId}/break-points/${id}`); }
  externalIds(id: number) { return this.api.get<M.ExternalIdItem[]>(`/admin/series/${id}/external-ids`); }
  setExternalId(id: number, providerId: number, externalId: string) { return this.api.put<M.ExternalIdItem>(`/admin/series/${id}/external-ids/${providerId}`, { externalId }); }
  removeExternalId(id: number, providerId: number) { return this.api.delete(`/admin/series/${id}/external-ids/${providerId}`); }
  importMetadata(id: number, providerId: number, languageCode: string | null, overwriteDetails = true, overwriteEpisodeTitles = true) {
    return this.api.post<M.MetadataImportResult>(`/admin/series/${id}/metadata/import`, { providerId, languageCode, overwriteDetails, overwriteEpisodeTitles });
  }

  // ── Interludios ──
  interludes(query: { kind?: string; season?: string; approved?: boolean | null; search?: string } = {}) {
    return this.api.get<M.InterludeItem[]>('/admin/interludes', { Kind: query.kind, Season: query.season, Approved: query.approved, Search: query.search });
  }
  uploadInterlude(value: InterludeForm, file: File) { return this.upload<M.InterludeItem>('/admin/interludes', form(value, { file })); }
  updateInterlude(id: number, value: InterludeForm) { return this.api.put<M.InterludeItem>(`/admin/interludes/${id}`, value); }
  approveInterlude(id: number, approved: boolean) { return this.api.put<void>(`/admin/interludes/${id}/approval`, { approved }); }
  deleteInterlude(id: number) { return this.api.delete(`/admin/interludes/${id}`); }

  // ── Espectadores ──
  viewerKpis() { return this.api.get<M.ViewerKpis>('/admin/viewers/kpis'); }
  viewers(search?: string, page = 1, pageSize = 25) { return this.api.get<M.Paged<M.ViewerProfileItem>>('/admin/viewers', { search, page, pageSize }); }
  viewer(id: string) { return this.api.get<M.ViewerProfileDetail>(`/admin/viewers/${id}`); }
  revokeDevice(deviceId: string) { return this.api.delete(`/admin/viewers/devices/${deviceId}`); }
  pendingAuthorizations() { return this.api.get<M.PendingAuthorizationItem[]>('/admin/viewers/authorizations'); }

  // ── Comentarios ──
  comments(status = 'Pending', search?: string, page = 1, pageSize = 25) { return this.api.get<M.ModerationPage>('/admin/comments', { status, search, page, pageSize }); }
  moderate(id: number, status: string) { return this.api.put<void>(`/admin/comments/${id}/status`, { status }); }
  moderateMany(commentIds: number[], status: string) { return this.api.put<void>('/admin/comments/status', { commentIds, status }); }

  // ── Media ──
  media(worker = 'all', view = 'pending', page = 1, pageSize = 20) { return this.api.get<M.MediaStatus>('/admin/media', { Worker: worker, View: view, Page: page, PageSize: pageSize }); }
  setWorker(worker: string, enabled: boolean) { return this.api.put<void>(`/admin/media/workers/${worker}`, { enabled }); }
  setResources(value: ResourceForm) { return this.api.put<M.ResourcePolicy>('/admin/media/resources', value); }
  retryJobs(jobIds: number[]) { return this.api.post<void>('/admin/media/jobs/retry', { jobIds }); }
  deleteJobs(jobIds: number[]) { return this.api.post<void>('/admin/media/jobs/delete', { jobIds }); }
  clearQueue(value: ClearQueueForm) { return this.api.post<{ deleted: number }>('/admin/media/jobs/clear', value); }
  storage() { return this.api.get<M.StorageReport>('/admin/media/storage'); }

  // ── Acceso ──
  users() { return this.api.get<M.UserListItem[]>('/admin/access/users'); }
  createUser(username: string, password: string, roleId: number) { return this.api.post<unknown>('/admin/access/users', { username, password, roleId }); }
  updateUser(id: number, username: string, password: string | null, roleId: number) { return this.api.put<unknown>(`/admin/access/users/${id}`, { username, password, roleId }); }
  deactivateUser(id: number) { return this.api.delete(`/admin/access/users/${id}`); }
  unlockUser(id: number) { return this.api.post<void>(`/admin/access/users/${id}/unlock`); }
  revokeUserSessions(id: number) { return this.api.post<void>(`/admin/access/users/${id}/sessions/revoke`); }
  unlinkUserLogin(id: number, provider: string) { return this.api.delete(`/admin/access/users/${id}/logins/${provider}`); }
  roles() { return this.api.get<M.RoleListItem[]>('/admin/access/roles'); }
  menus() { return this.api.get<M.MenuItem[]>('/admin/access/menus'); }
  createRole(name: string, description: string | null) { return this.api.post<M.RoleListItem>('/admin/access/roles', { name, description }); }
  updateRole(id: number, name: string, description: string | null) { return this.api.put<M.RoleListItem>(`/admin/access/roles/${id}`, { name, description }); }
  setRoleMenus(id: number, menuIds: number[]) { return this.api.put<M.RoleListItem>(`/admin/access/roles/${id}/menus`, { menuIds }); }
  deleteRole(id: number) { return this.api.delete(`/admin/access/roles/${id}`); }

  // ── Ajustes ──
  settings() { return this.api.get<M.PlatformSettings>('/admin/settings'); }
  updateSettings(value: PlatformSettingsForm) { return this.api.put<M.PlatformSettings>('/admin/settings', value); }
  categories() { return this.api.get<M.CatalogItem[]>('/admin/catalog/categories'); }
  episodeTypes() { return this.api.get<M.CatalogItem[]>('/admin/catalog/episode-types'); }
  providers() { return this.api.get<M.MetadataProviderItem[]>('/admin/catalog/providers'); }
  createCategory(name: string) { return this.api.post<M.CatalogItem>('/admin/settings/categories', { name }); }
  renameCategory(id: number, name: string) { return this.api.put<M.CatalogItem>(`/admin/settings/categories/${id}`, { name }); }
  deleteCategory(id: number) { return this.api.delete(`/admin/settings/categories/${id}`); }
  createEpisodeType(name: string) { return this.api.post<M.CatalogItem>('/admin/settings/episode-types', { name }); }
  renameEpisodeType(id: number, name: string) { return this.api.put<M.CatalogItem>(`/admin/settings/episode-types/${id}`, { name }); }
  deleteEpisodeType(id: number) { return this.api.delete(`/admin/settings/episode-types/${id}`); }
  createProvider(code: string, name: string) { return this.api.post<M.MetadataProviderItem>('/admin/settings/providers', { code, name }); }
  updateProvider(id: number, code: string, name: string) { return this.api.put<M.MetadataProviderItem>(`/admin/settings/providers/${id}`, { code, name }); }
  deleteProvider(id: number) { return this.api.delete(`/admin/settings/providers/${id}`); }
}

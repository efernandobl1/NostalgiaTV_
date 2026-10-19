import { HttpClient, HttpErrorResponse, HttpInterceptorFn, HttpParams, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, firstValueFrom, Observable, shareReplay, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import * as M from './models';

const API = '/api/v1';

/** Absolute URL of an API path or a stored media path (/uploads/...); same origin in production. */
export function apiUrl(path: string): string {
  return `${environment.apiUrl ?? ''}${path}`;
}

/** Media URL for an image or video path returned by the API (null-safe). */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return /^https?:\/\//.test(path) ? path : apiUrl(path.startsWith('/') ? path : `/${path}`);
}

/** Human message from a ProblemDetails / validation error response. */
export function errorMessage(error: unknown, fallback = 'No se pudo completar la acción. Vuelve a intentarlo.'): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error;
    if (body?.errors && typeof body.errors === 'object') {
      const first = Object.values(body.errors as Record<string, string[]>).flat()[0];
      if (first) return first;
    }
    if (typeof body?.detail === 'string' && body.detail) return body.detail;
    if (typeof body?.message === 'string' && body.message) return body.message;
    if (error.status === 0) return 'Sin conexión con el servidor.';
    if (error.status === 403) return 'No tienes permiso para esta acción.';
    if (error.status === 404) return 'No encontrado.';
    if (error.status === 429) return 'Demasiados intentos. Espera un momento.';
  }
  return fallback;
}

let refreshing: Observable<unknown> | null = null;

/**
 * Sends cookies with every API call and, when the short-lived access token expires (401),
 * rotates it once with the refresh cookie and retries the request.
 */
export const apiInterceptor: HttpInterceptorFn = (request: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
  const isApi = request.url.startsWith(API) || request.url.startsWith('/hubs');
  if (!isApi) return next(request);
  const http = inject(HttpClient);
  const prepared = request.clone({ url: apiUrl(request.url), withCredentials: true });
  // Auth calls and the TV's anonymous sign-in polling never trigger a refresh.
  const isAuth = request.url.startsWith(`${API}/auth/`) || request.url.startsWith(`${API}/viewer/authorization/redeem`);
  return next(prepared).pipe(catchError((error: unknown) => {
    if (!(error instanceof HttpErrorResponse) || error.status !== 401 || isAuth) return throwError(() => error);
    refreshing ??= http.post(`${API}/auth/refresh`, {}).pipe(shareReplay(1));
    return refreshing.pipe(
      switchMap(() => { refreshing = null; return next(prepared); }),
      catchError(refreshError => { refreshing = null; return throwError(() => refreshError instanceof HttpErrorResponse && refreshError.url?.includes('/auth/refresh') ? error : refreshError); }),
    );
  }));
};

function params(values: Record<string, string | number | boolean | null | undefined | (string | number)[]>): HttpParams {
  let result = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value)) value.forEach(item => result = result.append(key, String(item)));
    else result = result.set(key, String(value));
  }
  return result;
}

/** Typed client of the NostalgiaTV API v2. Every call returns a promise. */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  get<T>(path: string, query: Parameters<typeof params>[0] = {}): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${API}${path}`, { params: params(query) }));
  }
  post<T>(path: string, body: unknown = {}): Promise<T> { return firstValueFrom(this.http.post<T>(`${API}${path}`, body)); }
  put<T>(path: string, body: unknown = {}): Promise<T> { return firstValueFrom(this.http.put<T>(`${API}${path}`, body)); }
  delete<T = void>(path: string): Promise<T> { return firstValueFrom(this.http.delete<T>(`${API}${path}`)); }

  // ── Account ──
  server() { return this.get<M.ServerInfo>('/server'); }
  me() { return this.get<M.Me>('/account/me'); }
  login(username: string, password: string, rememberMe: boolean) { return this.post<void>('/auth/token', { username, password, rememberMe }); }
  register(username: string, password: string) { return this.post<void>('/auth/register', { username, password }); }
  logout() { return this.post<void>('/auth/revoke'); }
  changePassword(currentPassword: string, newPassword: string) { return this.put<void>('/account/password', { currentPassword, newPassword }); }
  revokeAllSessions() { return this.post<void>('/account/sessions/revoke'); }
  unlinkLogin(provider: string) { return this.delete(`/account/logins/${provider}`); }
  myComments() { return this.get<M.MyComment[]>('/account/comments'); }
  editComment(id: number, body: string) { return this.put<M.MyComment>(`/account/comments/${id}`, { body }); }
  deleteComment(id: number) { return this.delete(`/account/comments/${id}`); }

  // ── Public ──
  settings() { return this.get<M.PublicSettings>('/public/settings'); }
  categories() { return this.get<M.CategoryFacet[]>('/public/categories'); }
  channels() { return this.get<M.PublicChannelCard[]>('/public/channels'); }
  channel(id: number) { return this.get<M.PublicChannelDetail>(`/public/channels/${id}`); }
  channelState(id: number) { return this.get<M.ChannelState>(`/public/channels/${id}/state`); }
  programs(id: number, from?: string, to?: string) { return this.get<M.ScheduleProgram[]>(`/public/channels/${id}/programs`, { from, to }); }
  guide(day: string, channelId?: number) { return this.get<M.GuideRow[]>('/public/guide', { day, channelId }); }
  series(query: { search?: string; categoryIds?: number[]; decade?: number | null; onAirToday?: boolean; channelId?: number | null; sort?: string; page?: number; pageSize?: number }) {
    return this.get<M.Paged<M.PublicSeriesCard>>('/public/series', {
      Search: query.search, CategoryIds: query.categoryIds, Decade: query.decade, OnAirToday: query.onAirToday || null,
      ChannelId: query.channelId, Sort: query.sort, Page: query.page, PageSize: query.pageSize,
    });
  }
  seriesDetail(id: number) { return this.get<M.PublicSeriesDetail>(`/public/series/${id}`); }
  episodes(id: number, season?: number) { return this.get<M.PublicEpisode[]>(`/public/series/${id}/episodes`, { season }); }
  channelComments(id: number, page = 1) { return this.get<M.Paged<M.PublicComment>>(`/channels/${id}/comments`, { page }); }
  seriesComments(id: number, page = 1) { return this.get<M.Paged<M.PublicComment>>(`/series/${id}/comments`, { page }); }
  postChannelComment(id: number, body: string) { return this.post<M.CommentPosted>(`/channels/${id}/comments`, { body }); }
  postSeriesComment(id: number, body: string, parentCommentId?: number) { return this.post<M.CommentPosted>(`/series/${id}/comments`, { body, parentCommentId }); }

  // ── Viewer device ──
  viewerSession() { return this.get<M.ViewerSession>('/viewer/session'); }
  startViewer(name: string) { return this.post<M.ViewerSession>('/viewer/session', { name }); }
  progress(episodeId: number, startSecond: number, endSecond: number, duration: number, currentSecond: number) {
    return this.post<{ completed: boolean }>('/viewer/progress', { episodeId, startSecond, endSecond, duration, currentSecond });
  }
  clearHistory() { return this.delete('/viewer/history'); }
  resetSeries(seriesId: number) { return this.delete(`/viewer/series/${seriesId}/progress`); }
  removeDevice(id: string) { return this.delete(`/viewer/devices/${id}`); }
  inspectTv(code: string) { return this.post<M.DeviceAuthorizationInfo>('/viewer/authorization/inspect', { code }); }
  approveTv(code: string) { return this.post<void>('/viewer/authorization/approve', { code }); }
  startTvAuthorization(name: string) { return this.post<M.DeviceAuthorizationStart>('/viewer/authorization', { name }); }
  redeemTv(deviceCode: string) { return this.post<{ status: string }>('/viewer/authorization/redeem', { deviceCode }); }
}

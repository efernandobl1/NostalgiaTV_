import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Api } from './api/api';
import { Me, PublicSettings, ServerInfo, ViewerSession } from './api/models';

/**
 * Signed-in account (cookie session) plus this browser's viewer device, which owns the watch history.
 * Loaded once at startup; screens read the signals.
 */
@Injectable({ providedIn: 'root' })
export class Session {
  private readonly api = inject(Api);
  readonly me = signal<Me | null>(null);
  readonly viewer = signal<ViewerSession | null>(null);
  readonly server = signal<ServerInfo | null>(null);
  readonly settings = signal<PublicSettings | null>(null);
  readonly ready = signal(false);

  readonly signedIn = computed(() => this.me() !== null);
  readonly user = computed(() => this.me()?.username ?? 'Invitado');
  readonly initials = computed(() => (this.me()?.username ?? '').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || 'TV');
  readonly canUseDashboard = computed(() => this.me()?.canUseDashboard ?? false);
  /** Admin screen URLs the role can open (the menu tree flattened). */
  readonly screens = computed(() => {
    const urls = new Set<string>();
    const walk = (nodes: Me['menus']) => nodes.forEach(node => { if (node.url) urls.add(node.url); walk(node.children); });
    walk(this.me()?.menus ?? []);
    return urls;
  });

  async load(): Promise<void> {
    const [me, server, settings] = await Promise.allSettled([this.api.me(), this.api.server(), this.api.settings()]);
    this.me.set(me.status === 'fulfilled' ? me.value : null);
    if (server.status === 'fulfilled') this.server.set(server.value);
    if (settings.status === 'fulfilled') this.settings.set(settings.value);
    await this.ensureViewer();
    this.ready.set(true);
  }

  /** Starts (or resumes) this browser's viewer device; a signed-in account links it to its profile. */
  async ensureViewer(): Promise<ViewerSession | null> {
    try {
      const viewer = await this.api.startViewer(this.deviceName());
      this.viewer.set(viewer);
      return viewer;
    } catch {
      return null;
    }
  }

  async refreshViewer(): Promise<void> {
    try { this.viewer.set(await this.api.viewerSession()); }
    catch (error) { if (error instanceof HttpErrorResponse && error.status === 401) await this.ensureViewer(); }
  }

  async signIn(username: string, password: string, remember: boolean): Promise<Me> {
    await this.api.login(username, password, remember);
    try { localStorage.setItem('ntv.lastUser', username); } catch { /* private mode */ }
    const me = await this.api.me();
    this.me.set(me);
    await this.ensureViewer();
    return me;
  }

  async signOut(): Promise<void> {
    try { await this.api.logout(); } finally {
      await this.forget();
    }
  }

  /** Re-reads the account (role menus may have changed). */
  async reloadMe(): Promise<void> {
    try { this.me.set(await this.api.me()); } catch { /* keep the current state */ }
  }

  /** Drops the account locally after the server already ended the session (password change, revoke all). */
  async forget(): Promise<void> {
    this.me.set(null);
    await this.ensureViewer();
  }

  canOpen(url: string): boolean {
    return this.screens().has(url);
  }

  private deviceName(): string {
    const agent = navigator.userAgent;
    const browser = /Edg\//.test(agent) ? 'Edge' : /Chrome\//.test(agent) ? 'Chrome' : /Firefox\//.test(agent) ? 'Firefox' : /Safari\//.test(agent) ? 'Safari' : 'Navegador';
    const system = /Android/.test(agent) ? 'Android' : /iPhone|iPad/.test(agent) ? 'iOS' : /Windows/.test(agent) ? 'Windows' : /Mac OS/.test(agent) ? 'macOS' : /Linux/.test(agent) ? 'Linux' : '';
    return [browser, system].filter(Boolean).join(' · ');
  }
}

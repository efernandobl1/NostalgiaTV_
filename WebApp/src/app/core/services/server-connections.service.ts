import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

export function normalizeServerAddress(address: string): string {
  const value = address.trim();
  if (!value || value.length > 300 || /[\s\\]/.test(value)) throw new Error('Introduce la IP o el dominio de tu servidor.');
  let url: URL;
  try { url = new URL(value.includes('://') ? value : `https://${value}`); }
  catch { throw new Error('La dirección del servidor no es válida.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash || !url.hostname) {
    throw new Error('Usa solo una dirección HTTP o HTTPS, sin contraseñas ni rutas.');
  }
  const host = url.hostname;
  const local = host === 'localhost' || host === '[::1]' || /^127\./.test(host) ||
    /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^\[f[cd][a-f0-9]{2}:/i.test(host);
  if (url.protocol === 'http:' && !local) throw new Error('Para un servidor público, usa HTTPS. HTTP solo se permite en una red privada o VPN.');
  return url.origin;
}

@Injectable({ providedIn: 'root' })
export class ServerConnectionsService {
  private readonly document = inject(DOCUMENT);
  readonly current = this.document.defaultView?.location.origin ?? '';
  readonly recent = signal<string[]>(this.read());

  remember(address: string): void {
    const origin = normalizeServerAddress(address);
    const servers = [origin, ...this.recent().filter(item => item !== origin)].slice(0, 8);
    this.recent.set(servers);
    this.persist(servers);
  }
  forget(address: string): void {
    const servers = this.recent().filter(item => item !== address);
    this.recent.set(servers);
    this.persist(servers);
  }
  private read(): string[] {
    try {
      const stored: unknown = JSON.parse(this.document.defaultView?.localStorage.getItem('nostalgia-servers') ?? '[]');
      if (!Array.isArray(stored)) return [];
      return [...new Set(stored.filter(item => typeof item === 'string').flatMap(item => {
        try { return [normalizeServerAddress(item)]; } catch { return []; }
      }))].slice(0, 8);
    } catch { return []; }
  }
  private persist(servers: string[]): void {
    try { this.document.defaultView?.localStorage.setItem('nostalgia-servers', JSON.stringify(servers)); }
    catch { /* Browsing remains available without local storage. */ }
  }
}

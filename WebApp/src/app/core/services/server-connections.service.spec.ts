import { TestBed } from '@angular/core/testing';
import { normalizeServerAddress, ServerConnectionsService } from './server-connections.service';

describe('Server connections', () => {
  beforeEach(() => { localStorage.removeItem('nostalgia-servers'); TestBed.resetTestingModule(); });
  afterEach(() => localStorage.removeItem('nostalgia-servers'));
  it('normalizes a domain and explicit private VPN addresses', () => {
    expect(normalizeServerAddress(' tv.example.com ')).toBe('https://tv.example.com');
    expect(normalizeServerAddress('http://10.77.77.1:8090')).toBe('http://10.77.77.1:8090');
    expect(normalizeServerAddress('http://[fd00::1]:8090')).toBe('http://[fd00::1]:8090');
  });
  it('rejects unsafe schemes, embedded credentials, public HTTP and URL payloads', () => {
    for (const value of ['javascript://alert(1)', 'ftp://tv.example.com', 'https://user:password@tv.example.com', 'http://tv.example.com', 'https://tv.example.com/path', 'https://tv.example.com/?token=secret', 'https://tv.example.com/#data', 'https://tv.example.com\\@evil.example']) {
      expect(() => normalizeServerAddress(value)).toThrow();
    }
  });
  it('stores only canonical server origins, deduplicates and forgets them', () => {
    const service = TestBed.inject(ServerConnectionsService);
    service.remember('tv.example.com'); service.remember('https://tv.example.com/');
    expect(service.recent()).toEqual(['https://tv.example.com']);
    service.forget('https://tv.example.com'); expect(service.recent()).toEqual([]);
  });
  it('discards invalid saved destinations and limits recent servers', () => {
    localStorage.setItem('nostalgia-servers', JSON.stringify(['javascript://attack', 'http://public.example', ...Array.from({ length: 12 }, (_, index) => `https://tv${index}.example.com`)]));
    const service = TestBed.inject(ServerConnectionsService);
    expect(service.recent().length).toBe(8);
    expect(service.recent().every(item => item.startsWith('https://'))).toBe(true);
  });
});

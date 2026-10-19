import { DestroyRef, inject, Injectable, NgZone } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { apiUrl } from '../api/api';

/**
 * A channel change pushed by the API hub (/hubs/channel, "ChannelChanged"): a new segment started (`kind` is its
 * kind: Episode, Bumper, Advertisement), the schedule was rewritten (for example an era went on air) or the channel was
 * added or removed. `reconnected` is local: the link came back and changes may have been missed.
 */
export interface ChannelChange { channelId: number; reason: 'segment' | 'schedule' | 'lineup' | 'reconnected'; kind?: string | null }

type Listener = (change: ChannelChange) => void;

/** Waits between attempts when the hub cannot be reached; screens keep polling meanwhile. */
const RETRY_MS = 30_000;
/** Keeps the connection a little while after the last screen leaves, so moving between pages does not reconnect. */
const IDLE_MS = 10_000;

/**
 * Real-time channel changes for the public screens. Connects on the first listener, joins the hub's lineup group and
 * disconnects when nobody listens. It only speeds things up: every screen still polls, so a blocked WebSocket or a
 * hub outage just means changes arrive with the next poll.
 */
@Injectable({ providedIn: 'root' })
export class ChannelEvents {
  private readonly zone = inject(NgZone);
  private readonly listeners = new Set<Listener>();
  private hub: HubConnection | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private idle: ReturnType<typeof setTimeout> | null = null;

  /** Calls `listener` for every change until the calling screen is destroyed. */
  listen(listener: Listener, destroyRef = inject(DestroyRef)): void {
    this.listeners.add(listener);
    destroyRef.onDestroy(() => {
      this.listeners.delete(listener);
      if (!this.listeners.size) this.idle = setTimeout(() => this.stop(), IDLE_MS);
    });
    if (this.idle) { clearTimeout(this.idle); this.idle = null; }
    this.start();
  }

  private start(): void {
    if (this.hub || this.retry || typeof WebSocket === 'undefined') return;
    const hub = new HubConnectionBuilder()
      .withUrl(apiUrl('/hubs/channel'))
      .withAutomaticReconnect([0, 2_000, 10_000, 30_000])
      .configureLogging(LogLevel.None)
      .build();
    this.hub = hub;
    hub.on('ChannelChanged', (change: ChannelChange) => this.emit(change));
    // Groups do not survive a reconnection.
    hub.onreconnected(() => hub.invoke('WatchLineup').then(() => this.emit({ channelId: 0, reason: 'reconnected' })).catch(() => {}));
    hub.onclose(() => { if (this.hub === hub) this.later(); });
    hub.start().then(() => hub.invoke('WatchLineup')).catch(() => { if (this.hub === hub) this.later(); });
  }

  private later(): void {
    this.hub = null;
    if (!this.listeners.size) return;
    this.retry = setTimeout(() => { this.retry = null; this.start(); }, RETRY_MS);
  }

  private stop(): void {
    this.idle = null;
    if (this.retry) { clearTimeout(this.retry); this.retry = null; }
    const hub = this.hub;
    this.hub = null;
    if (hub && hub.state !== HubConnectionState.Disconnected) hub.stop().catch(() => {});
  }

  private emit(change: ChannelChange): void {
    this.zone.run(() => this.listeners.forEach(listener => listener(change)));
  }
}

/** A function that runs `action` once, `delay` ms after the last call (a burst of changes means one refresh). */
export function debounce(action: () => void, delay: number): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; action(); }, delay);
  };
}

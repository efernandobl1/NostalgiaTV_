import { Injectable } from '@angular/core';

export interface WatchProgress {
    episodeId: number;
    currentSecond: number;
    completed: boolean;
}

@Injectable({ providedIn: 'root' })
export class WatchedService {
    private key(seriesId: number): string {
        return `watched_${seriesId}`;
    }

    getProgress(seriesId: number): Record<number, WatchProgress> {
        try {
            const raw = localStorage.getItem(this.key(seriesId));
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    markProgress(seriesId: number, episodeId: number, currentSecond: number, completed: boolean): void {
        const progress = this.getProgress(seriesId);
        progress[episodeId] = { episodeId, currentSecond, completed };
        localStorage.setItem(this.key(seriesId), JSON.stringify(progress));
    }

    isWatched(seriesId: number, episodeId: number): boolean {
        return this.getProgress(seriesId)[episodeId]?.completed ?? false;
    }

    getLastProgress(seriesId: number, episodeId: number): number {
        return this.getProgress(seriesId)[episodeId]?.currentSecond ?? 0;
    }

    resetSeries(seriesId: number): void {
        localStorage.removeItem(this.key(seriesId));
    }

    resetAll(): void {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('watched_'));
        keys.forEach(k => localStorage.removeItem(k));
    }

    getNextUnwatched(seriesId: number, episodes: { id: number }[]): { id: number } | null {
        const progress = this.getProgress(seriesId);
        return episodes.find(e => !progress[e.id]?.completed) ?? episodes[0] ?? null;
    }
}

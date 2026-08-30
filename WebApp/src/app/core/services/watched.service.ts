import { Injectable } from '@angular/core';

export interface WatchProgress {
    episodeId: number;
    currentSecond: number;
    completed: boolean;
    updatedAt?: number;
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
        progress[episodeId] = { episodeId, currentSecond, completed, updatedAt: Date.now() };
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

    /**
     * Episodio a reanudar: el último realmente visto (mayor updatedAt). Si ese quedó
     * completo, avanza al siguiente de la lista; si no hay progreso con marca de
     * tiempo, cae en el primero sin ver.
     */
    getResume<T extends { id: number }>(seriesId: number, episodes: T[]): T | null {
        const progress = this.getProgress(seriesId);
        const withProgress = episodes
            .map(e => ({ ep: e, p: progress[e.id] }))
            .filter((x): x is { ep: T; p: WatchProgress } => !!x.p && (x.p.updatedAt ?? 0) > 0)
            .sort((a, b) => (b.p.updatedAt ?? 0) - (a.p.updatedAt ?? 0));

        if (withProgress.length) {
            const last = withProgress[0];
            if (!last.p.completed) return last.ep;
            const idx = episodes.findIndex(e => e.id === last.ep.id);
            return episodes[idx + 1] ?? last.ep;
        }
        return (this.getNextUnwatched(seriesId, episodes) as T | null);
    }
}

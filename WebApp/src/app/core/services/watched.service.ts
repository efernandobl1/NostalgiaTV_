import { Injectable } from '@angular/core';

export interface WatchProgress {
    currentSecond: number;
    completed: boolean;
    updatedAt?: number;
}

/** Identidad mínima de un episodio para calcular su clave estable. */
export interface EpisodeRef {
    id: number;
    season: number;
    episodeNumber: number;
}

/**
 * Progreso de reproducción por serie, en localStorage.
 *
 * IMPORTANTE: la clave NO es el episodeId (que cambia al re-escanear archivos)
 * sino "temporada+número" (estable entre escaneos). Si un episodio no tiene número
 * parseado (0), cae a "id<episodeId>" como último recurso.
 */
@Injectable({ providedIn: 'root' })
export class WatchedService {
    private key(seriesId: number): string {
        return `watched_${seriesId}`;
    }

    /** Clave estable de un episodio dentro de su serie. */
    private epKey(ep: EpisodeRef): string {
        return ep.episodeNumber > 0 ? `s${ep.season}e${ep.episodeNumber}` : `id${ep.id}`;
    }

    getProgress(seriesId: number): Record<string, WatchProgress> {
        try {
            const raw = localStorage.getItem(this.key(seriesId));
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    markProgress(seriesId: number, ep: EpisodeRef, currentSecond: number, completed: boolean): void {
        const progress = this.getProgress(seriesId);
        progress[this.epKey(ep)] = { currentSecond, completed, updatedAt: Date.now() };
        localStorage.setItem(this.key(seriesId), JSON.stringify(progress));
    }

    isWatched(seriesId: number, ep: EpisodeRef): boolean {
        return this.getProgress(seriesId)[this.epKey(ep)]?.completed ?? false;
    }

    getLastProgress(seriesId: number, ep: EpisodeRef): number {
        return this.getProgress(seriesId)[this.epKey(ep)]?.currentSecond ?? 0;
    }

    resetSeries(seriesId: number): void {
        localStorage.removeItem(this.key(seriesId));
    }

    resetAll(): void {
        Object.keys(localStorage).filter(k => k.startsWith('watched_')).forEach(k => localStorage.removeItem(k));
    }

    getNextUnwatched<T extends EpisodeRef>(seriesId: number, episodes: T[]): T | null {
        const progress = this.getProgress(seriesId);
        return episodes.find(e => !progress[this.epKey(e)]?.completed) ?? episodes[0] ?? null;
    }

    /**
     * Episodio a reanudar: el último realmente visto (mayor updatedAt). Si ese quedó
     * completo, avanza al siguiente de la lista; si no hay progreso con marca de
     * tiempo, cae en el primero sin ver.
     */
    getResume<T extends EpisodeRef>(seriesId: number, episodes: T[]): T | null {
        const progress = this.getProgress(seriesId);
        const withProgress = episodes
            .map(e => ({ ep: e, p: progress[this.epKey(e)] }))
            .filter((x): x is { ep: T; p: WatchProgress } => !!x.p && (x.p.updatedAt ?? 0) > 0)
            .sort((a, b) => (b.p.updatedAt ?? 0) - (a.p.updatedAt ?? 0));

        if (withProgress.length) {
            const last = withProgress[0];
            if (!last.p.completed) return last.ep;
            const idx = episodes.findIndex(e => e.id === last.ep.id);
            return episodes[idx + 1] ?? last.ep;
        }
        return this.getNextUnwatched(seriesId, episodes);
    }
}

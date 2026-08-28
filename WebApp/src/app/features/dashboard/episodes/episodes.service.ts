import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { EpisodeResponse, UpdateEpisodeRequest } from '../../../shared/models/episode.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class EpisodesService {
    private readonly apiUrl = `${environment.apiUrl}/api/v1/episodes`;

    constructor(private http: HttpClient) {}

    getBySeries(seriesId: number) {
        return this.http.get<EpisodeResponse[]>(`${this.apiUrl}/series/${seriesId}`, { withCredentials: true });
    }

    update(id: number, request: UpdateEpisodeRequest) {
        return this.http.put<EpisodeResponse>(`${this.apiUrl}/${id}`, request, { withCredentials: true });
    }

    scan(seriesId: number) {
        return this.http.post<EpisodeResponse[]>(`${environment.apiUrl}/api/v1/series/${seriesId}/scan`, {}, { withCredentials: true });
    }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import {
    ChannelEraRequest,
    ChannelEraResponse,
    AssignSeriesToEraRequest,
} from '../../../shared/models/channel-era.model';

@Injectable({ providedIn: 'root' })
export class ChannelErasService {
    private readonly apiUrl = `${environment.apiUrl}/api/v1`;

    constructor(private http: HttpClient) {}

    getByChannel(channelId: number) {
        return this.http.get<ChannelEraResponse[]>(`${this.apiUrl}/channels/${channelId}/eras`, { withCredentials: true });
    }

    getById(eraId: number) {
        return this.http.get<ChannelEraResponse>(`${this.apiUrl}/channels/0/eras/${eraId}`, { withCredentials: true });
    }

    create(channelId: number, request: ChannelEraRequest) {
        return this.http.post<ChannelEraResponse>(`${this.apiUrl}/channels/${channelId}/eras`, request, { withCredentials: true });
    }

    update(eraId: number, request: ChannelEraRequest) {
        return this.http.put<ChannelEraResponse>(`${this.apiUrl}/channels/0/eras/${eraId}`, request, { withCredentials: true });
    }

    delete(eraId: number) {
        return this.http.delete(`${this.apiUrl}/channels/0/eras/${eraId}`, { withCredentials: true });
    }

    assignSeries(eraId: number, request: AssignSeriesToEraRequest) {
        return this.http.put<ChannelEraResponse>(`${this.apiUrl}/channels/0/eras/${eraId}/series`, request, { withCredentials: true });
    }
}

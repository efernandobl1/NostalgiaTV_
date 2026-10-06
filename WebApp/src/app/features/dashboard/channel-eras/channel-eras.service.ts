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
    return this.http.get<ChannelEraResponse[]>(`${this.apiUrl}/channels/${channelId}/eras`, {
      withCredentials: true,
    });
  }

  getById(channelId: number, eraId: number) {
    return this.http.get<ChannelEraResponse>(`${this.apiUrl}/channels/${channelId}/eras/${eraId}`, {
      withCredentials: true,
    });
  }

  create(channelId: number, request: ChannelEraRequest) {
    return this.http.post<ChannelEraResponse>(
      `${this.apiUrl}/channels/${channelId}/eras`,
      request,
      { withCredentials: true },
    );
  }

  update(channelId: number, eraId: number, request: ChannelEraRequest) {
    return this.http.put<ChannelEraResponse>(
      `${this.apiUrl}/channels/${channelId}/eras/${eraId}`,
      request,
      { withCredentials: true },
    );
  }

  delete(channelId: number, eraId: number) {
    return this.http.delete(`${this.apiUrl}/channels/${channelId}/eras/${eraId}`, {
      withCredentials: true,
    });
  }

  assignSeries(channelId: number, eraId: number, request: AssignSeriesToEraRequest) {
    return this.http.put<ChannelEraResponse>(
      `${this.apiUrl}/channels/${channelId}/eras/${eraId}/series`,
      request,
      { withCredentials: true },
    );
  }

  activate(channelId: number, eraId: number) {
    return this.http.put(
      `${this.apiUrl}/channels/${channelId}/eras/${eraId}/activate`,
      {},
      { withCredentials: true },
    );
  }
}

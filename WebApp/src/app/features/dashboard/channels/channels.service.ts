import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ChannelRequest,
  ChannelResponse,
  AssignSeriesRequest,
} from '../../../shared/models/channel.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ChannelsService {
  private readonly apiUrl = `${environment.apiUrl}/api/v1/channels`;

  constructor(private http: HttpClient) {}

  getAll() {
    return this.http.get<ChannelResponse[]>(this.apiUrl, { withCredentials: true });
  }

  create(request: FormData) {
    return this.http.post<ChannelResponse>(this.apiUrl, request, { withCredentials: true });
  }

  update(id: number, request: FormData) {
    return this.http.put<ChannelResponse>(`${this.apiUrl}/${id}`, request, {
      withCredentials: true,
    });
  }

  assignSeries(channelId: number, request: AssignSeriesRequest) {
    return this.http.put<ChannelResponse>(`${this.apiUrl}/${channelId}/series`, request, {
      withCredentials: true,
    });
  }
}

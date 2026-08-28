import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ChannelBumperResponse } from '../../../shared/models/channel-era.model';

@Injectable({ providedIn: 'root' })
export class ChannelBumpersService {
    private readonly apiUrl = `${environment.apiUrl}/api/v1`;

    constructor(private http: HttpClient) {}

    getByEra(eraId: number) {
        return this.http.get<ChannelBumperResponse[]>(`${this.apiUrl}/eras/${eraId}/bumpers`, { withCredentials: true });
    }

    getById(eraId: number, bumperId: number) {
        return this.http.get<ChannelBumperResponse>(`${this.apiUrl}/eras/${eraId}/bumpers/${bumperId}`, { withCredentials: true });
    }

    create(eraId: number, formData: FormData) {
        return this.http.post<ChannelBumperResponse>(`${this.apiUrl}/eras/${eraId}/bumpers`, formData, { withCredentials: true });
    }

    update(bumperId: number, formData: FormData) {
        return this.http.put<ChannelBumperResponse>(`${this.apiUrl}/eras/0/bumpers/${bumperId}`, formData, { withCredentials: true });
    }

    delete(bumperId: number) {
        return this.http.delete(`${this.apiUrl}/eras/0/bumpers/${bumperId}`, { withCredentials: true });
    }

    getRandom(eraId: number) {
        return this.http.get<ChannelBumperResponse>(`${this.apiUrl}/eras/${eraId}/bumpers/random`, { withCredentials: true });
    }

    scan(eraId: number) {
        return this.http.post<ChannelBumperResponse[]>(`${this.apiUrl}/eras/${eraId}/bumpers/scan`, {}, { withCredentials: true });
    }
}

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface DeviceTicket { deviceCode: string; userCode: string; expiresAtUtc: string; interval: number; }
export interface DeviceConfirmation { name: string; expiresAtUtc: string; }

@Injectable({ providedIn: 'root' })
export class DeviceAccessService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/v1/viewer/authorization`;
  inspect(code: string) { return this.http.post<DeviceConfirmation>(`${this.url}/inspect`, { code }, { withCredentials: true }); }
  approve(code: string) { return this.http.post<void>(`${this.url}/approve`, { code }, { withCredentials: true }); }
  createQr() { return this.http.post<DeviceTicket>(`${this.url}/qr`, { name: 'App Android' }, { withCredentials: true }); }
}

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  ActivityResponse,
  DashboardSummaryResponse,
  StorageResponse,
} from '../../shared/models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/api/v1/dashboard`;

  getSummary() {
    return this.http.get<DashboardSummaryResponse>(`${this.apiUrl}/summary`, {
      withCredentials: true,
    });
  }

  getStorage() {
    return this.http.get<StorageResponse>(`${this.apiUrl}/storage`, { withCredentials: true });
  }

  getActivity(days: number) {
    return this.http.get<ActivityResponse[]>(`${this.apiUrl}/activity`, {
      params: { days },
      withCredentials: true,
    });
  }
}

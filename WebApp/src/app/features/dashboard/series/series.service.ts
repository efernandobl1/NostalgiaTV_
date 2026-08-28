import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SeriesRequest, SeriesResponse } from '../../../shared/models/serie.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SeriesService {
  private readonly apiUrl = `${environment.apiUrl}/api/v1/series`;

  constructor(private http: HttpClient) {}

  getAll() {
    return this.http.get<SeriesResponse[]>(this.apiUrl, { withCredentials: true });
  }

  getById(id: number) {
    return this.http.get<SeriesResponse>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  create(request: FormData) {
    return this.http.post<SeriesResponse>(this.apiUrl, request, { withCredentials: true });
  }

  update(id: number, request: FormData) {
    return this.http.put<SeriesResponse>(`${this.apiUrl}/${id}`, request, {
      withCredentials: true,
    });
  }

  delete(id: number) {
    return this.http.delete(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  assignCategories(id: number, categoryIds: number[]) {
    return this.http.post<SeriesResponse>(`${this.apiUrl}/${id}/categories`, categoryIds, {
      withCredentials: true,
    });
  }
}

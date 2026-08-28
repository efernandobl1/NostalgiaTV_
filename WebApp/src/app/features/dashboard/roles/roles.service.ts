import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RolRequest, RolResponse } from '../../../shared/models/rol.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class RolesService {
    private readonly apiUrl = `${environment.apiUrl}/api/v1/roles`;

    constructor(private http: HttpClient) {}

    getAll() {
        return this.http.get<RolResponse[]>(this.apiUrl, { withCredentials: true });
    }

    create(request: RolRequest) {
        return this.http.post<RolResponse>(this.apiUrl, request, { withCredentials: true });
    }

    update(id: number, request: RolRequest) {
        return this.http.put<RolResponse>(`${this.apiUrl}/${id}`, request, { withCredentials: true });
    }

    delete(id: number) {
        return this.http.delete(`${this.apiUrl}/${id}`, { withCredentials: true });
    }
}

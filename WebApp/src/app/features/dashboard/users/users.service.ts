import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UserRequest, UserResponse } from '../../../shared/models/user.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UsersService {
    private readonly apiUrl = `${environment.apiUrl}/api/v1/users`;

    constructor(private http: HttpClient) {}

    getAll() {
        return this.http.get<UserResponse[]>(this.apiUrl, { withCredentials: true });
    }

    create(request: UserRequest) {
        return this.http.post<UserResponse>(this.apiUrl, request, { withCredentials: true });
    }

    update(id: number, request: UserRequest) {
        return this.http.put<UserResponse>(`${this.apiUrl}/${id}`, request, { withCredentials: true });
    }

    delete(id: number) {
        return this.http.delete(`${this.apiUrl}/${id}`, { withCredentials: true });
    }
}

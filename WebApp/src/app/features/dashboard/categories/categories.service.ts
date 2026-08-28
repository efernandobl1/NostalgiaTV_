import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CategoryRequest, CategoryResponse } from '../../../shared/models/category.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CategoriesService {
    private readonly apiUrl = `${environment.apiUrl}/api/v1/category`;

    constructor(private http: HttpClient) {}

    getAll() {
        return this.http.get<CategoryResponse[]>(this.apiUrl, { withCredentials: true });
    }

    create(request: CategoryRequest) {
        return this.http.post<CategoryResponse>(this.apiUrl, request, { withCredentials: true });
    }

    update(id: number, request: CategoryRequest) {
        return this.http.put<CategoryResponse>(`${this.apiUrl}/${id}`, request, { withCredentials: true });
    }

    delete(id: number) {
        return this.http.delete(`${this.apiUrl}/${id}`, { withCredentials: true });
    }
}

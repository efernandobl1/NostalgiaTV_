import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MenuResponse } from '../../shared/models/menu.model';
import { UserResponse } from '../../shared/models/user.model';
import { environment } from '../../../environments/environment';
import { switchMap, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly apiUrl = `${environment.apiUrl}/api/v1`;

  currentUser = signal<UserResponse | null>(null);
  menus = signal<MenuResponse[]>([]);

  constructor(private http: HttpClient) {}

  loadCurrentUser() {
    return this.http.get<UserResponse>(`${this.apiUrl}/users/me`, { withCredentials: true }).pipe(
      tap((user) => this.currentUser.set(user)),
      switchMap(() =>
        this.http.get<MenuResponse[]>(`${this.apiUrl}/menus`, { withCredentials: true }),
      ),
      tap((menus) => this.menus.set(menus)),
    );
  }

  getAllMenus() {
    return this.http.get<MenuResponse[]>(`${this.apiUrl}/menus/all`, { withCredentials: true });
  }
}

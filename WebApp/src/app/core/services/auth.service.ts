import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LoginRequest } from '../../shared/models/auth.model';
import { environment } from '../../../environments/environment';
import { finalize, Observable, shareReplay, switchMap, tap } from 'rxjs';
import { MenuResponse } from '../../shared/models/menu.model';
import { MenuService } from './menu.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/api/v1/auth`;
  isAuthenticated = signal<boolean>(false);
  private sessionRequest?: Observable<MenuResponse[]>;

  constructor(
    private http: HttpClient,
    private menuService: MenuService,
  ) {}

  login(request: LoginRequest) {
    return this.http.post(`${this.apiUrl}/token`, request, { withCredentials: true }).pipe(
      tap(() => this.isAuthenticated.set(true)),
      switchMap(() => this.menuService.loadCurrentUser()),
    );
  }

  refresh() {
    return this.http
      .post(`${this.apiUrl}/refresh`, {}, { withCredentials: true })
      .pipe(tap(() => this.isAuthenticated.set(true)));
  }

  logout() {
    return this.http
      .post(`${this.apiUrl}/revoke`, {}, { withCredentials: true })
      .pipe(tap(() => this.isAuthenticated.set(false)));
  }

  checkSession() {
    this.sessionRequest ??= this.http
      .post(`${this.apiUrl}/refresh`, {}, { withCredentials: true })
      .pipe(
        tap(() => this.isAuthenticated.set(true)),
        switchMap(() => this.menuService.loadCurrentUser()),
        finalize(() => (this.sessionRequest = undefined)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.sessionRequest;
  }
}

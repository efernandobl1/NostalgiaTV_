import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';

interface PublicComment { id: number; author: string; body: string; createdAtUtc: string; }
@Component({ selector: 'app-public-comments', imports: [DatePipe, FormsModule, RouterLink], templateUrl: './public-comments.component.html', styleUrl: './public-comments.component.scss' })
export class PublicCommentsComponent {
  readonly kind = input.required<'series' | 'channels'>();
  readonly targetId = input.required<number>();
  private readonly http = inject(HttpClient);
  readonly comments = signal<PublicComment[]>([]);
  readonly loading = signal(false);
  readonly sending = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly loginRequired = signal(false);
  readonly page = signal(1);
  readonly nextAvailable = signal(false);
  body = '';
  constructor() { effect(() => { this.kind(); this.targetId(); untracked(() => { this.page.set(1); this.body = ''; this.message.set(''); this.load(); }); }); }
  private url(): string { return `${environment.apiUrl}/api/v1/${this.kind()}/${this.targetId()}/comments`; }
  load(): void {
    this.loading.set(true); this.error.set('');
    const id = this.targetId(), kind = this.kind();
    this.http.get<PublicComment[]>(this.url(), { params: { page: this.page() } }).subscribe({
      next: comments => { if (id !== this.targetId() || kind !== this.kind()) return; this.comments.set(comments); this.nextAvailable.set(comments.length === 50); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set('No se pudieron cargar los comentarios.'); },
    });
  }
  changePage(delta: number): void { this.page.update(value => value + delta); this.load(); }
  send(): void {
    if (this.sending() || !this.body.trim() || this.body.length > 2000) return;
    this.sending.set(true); this.error.set(''); this.message.set(''); this.loginRequired.set(false);
    this.http.post(this.url(), { body: this.body, parentCommentId: null }).subscribe({
      next: () => { this.sending.set(false); this.body = ''; this.message.set('Comentario enviado. Se publicará después de revisarlo.'); },
      error: error => { this.sending.set(false); this.loginRequired.set(error.status === 401); this.error.set(error.status === 401 ? 'Inicia sesión para comentar.' : error.status === 429 ? 'Espera un minuto antes de enviar otro comentario.' : 'No se pudo enviar el comentario. Reintenta.'); },
    });
  }
}

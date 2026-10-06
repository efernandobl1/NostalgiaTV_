import { Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BroadcastAdminService, ModeratedComment } from '../broadcast-admin.service';

@Component({
  selector: 'app-community',
  imports: [DatePipe, RouterLink],
  templateUrl: './community.component.html',
  styleUrl: './community.component.scss',
})
export class CommunityComponent {
  readonly seriesId = input<number | null>(null);
  private readonly service = inject(BroadcastAdminService);
  readonly status = signal('Pending');
  readonly comments = signal<ModeratedComment[]>([]);
  readonly count = signal(0);
  readonly page = signal(1);
  readonly loading = signal(true);
  readonly busy = signal<number | null>(null);
  readonly error = signal('');
  readonly filters = [
    { value: 'Pending', label: 'Por revisar' },
    { value: 'Approved', label: 'Publicados' },
    { value: 'Rejected', label: 'Rechazados' },
    { value: 'Hidden', label: 'Ocultos' },
  ];
  readonly previousPage = (page: number) => page - 1;
  readonly nextPage = (page: number) => page + 1;
  constructor() {
    effect(() => {
      this.seriesId();
      this.status();
      this.page();
      this.load();
    });
  }
  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service.comments(this.status(), this.page(), this.seriesId()).subscribe({
      next: (result) => {
        this.comments.set(result.items);
        this.count.set(result.totalCount);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los comentarios.');
        this.loading.set(false);
      },
    });
  }
  filter(status: string): void {
    this.status.set(status);
    this.page.set(1);
  }
  moderate(comment: ModeratedComment, status: string): void {
    if (this.busy() !== null) return;
    this.busy.set(comment.id);
    this.service.moderate(comment, status).subscribe({
      next: () => {
        this.busy.set(null);
        if (this.comments().length === 1 && this.page() > 1) this.page.update((page) => page - 1);
        else this.load();
      },
      error: () => {
        this.busy.set(null);
        this.error.set('No se pudo cambiar el estado del comentario.');
      },
    });
  }
}

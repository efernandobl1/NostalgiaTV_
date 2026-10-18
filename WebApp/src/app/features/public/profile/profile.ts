import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Devices } from '../../../core/devices';
import { seriesIdByName } from '../../../core/data/series';
import { Session } from '../../../core/session';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { ProgressBar } from '../../../shared/ui/progress-bar';

interface HistoryItem { series: string; code: string; title: string; pct: number; when: string; mobileWhen: string }
interface MyComment { id: number; target: string; short: string; link: (string | number)[]; time: string; status: 'pending' | 'published' | 'rejected'; body: string }

const STATUS = {
  pending: { label: 'PENDIENTE DE MODERACIÓN', short: 'PENDIENTE', color: '#FFB547' },
  published: { label: 'PUBLICADO', short: 'PUBLICADO', color: '#8BE08F' },
  rejected: { label: 'RECHAZADO', short: 'RECHAZADO', color: '#FF8A80' },
};

/** Design: "Web · Perfil e historial" + "Móvil · Perfil e historial". */
@Component({
  selector: 'app-profile',
  imports: [RouterLink, ProgressBar, ConfirmDialog],
  host: { class: 'flex-1 flex flex-col' },
  templateUrl: './profile.html',
})
export class Profile {
  private readonly router = inject(Router);
  protected readonly session = inject(Session);
  protected readonly devices = inject(Devices);
  readonly status = STATUS;

  readonly tab = signal(0);
  readonly filter = signal(0);
  readonly confirm = signal<'clear' | 'everywhere' | null>(null);

  readonly history = signal<HistoryItem[]>([
    { series: 'Dragon Ball Z', code: 'T2 · E14', title: 'El poder oculto de Gohan', pct: 64, when: 'hoy 14:20', mobileWhen: 'hoy' },
    { series: 'Pokémon', code: 'T3 · E01', title: 'Episodio 1', pct: 21, when: 'ayer', mobileWhen: 'ayer' },
    { series: 'Hey Arnold!', code: 'T1 · E07', title: 'Episodio 7', pct: 100, when: 'hace 3 días', mobileWhen: 'hace 3 días' },
    { series: 'Los Simpson', code: 'T5 · E20', title: 'Episodio 20', pct: 100, when: 'hace 5 días', mobileWhen: 'hace 5 días' },
    { series: 'Digimon Adventure', code: 'T1 · E11', title: 'Episodio 11', pct: 45, when: 'hace 1 semana', mobileWhen: 'hace 1 semana' },
  ]);
  readonly filtered = computed(() => {
    const f = this.filter();
    return this.history()
      .filter(h => f === 0 || (f === 1 ? h.pct < 100 : h.pct >= 100))
      .map(h => ({ ...h, id: seriesIdByName(h.series) ?? 1, done: h.pct >= 100 }));
  });

  readonly comments = signal<MyComment[]>([
    { id: 1, target: 'Serie · Dragon Ball Z', short: 'Dragon Ball Z', link: ['/series', 1], time: 'hace 2 h', status: 'pending', body: 'Me encanta que pusieran la saga de Namek completa.' },
    { id: 2, target: 'Canal · Anime 90s', short: 'Canal · Anime 90s', link: ['/canal', 23], time: 'hace 4 días', status: 'published', body: 'Podrían agregar más cortes comerciales en la tarde.' },
    { id: 3, target: 'Serie · Pokémon', short: 'Pokémon', link: ['/series', 4], time: 'hace 2 semanas', status: 'rejected', body: '[Comentario rechazado por el moderador]' },
  ]);
  readonly editing = signal<number | null>(null);

  // Account
  readonly googleLinked = signal(true);
  readonly passwordSaved = signal(false);
  readonly settings = [
    { label: 'Reproducir con datos móviles', hint: 'Si está apagado, solo con Wi-Fi', on: true },
    { label: 'Mostrar número al cambiar de canal', hint: 'Número verde estilo TV de tubo', on: true },
    { label: 'Efectos de temporada', hint: 'Halloween y Navidad', on: true },
    { label: 'Subtítulos', hint: 'Cuando estén disponibles', on: false },
  ];

  removeHistory(series: string): void { this.history.update(l => l.filter(h => h.series !== series)); }

  saveComment(id: number, body: string): void {
    const text = body.trim();
    if (text) this.comments.update(l => l.map(c => (c.id === id ? { ...c, body: text, status: 'pending', time: 'ahora' } : c)));
    this.editing.set(null);
  }

  deleteComment(id: number): void { this.comments.update(l => l.filter(c => c.id !== id)); }

  savePassword(current: HTMLInputElement, next: HTMLInputElement): void {
    if (!current.value || next.value.length < 8) return;
    current.value = next.value = '';
    this.passwordSaved.set(true);
  }

  onConfirm(): void {
    if (this.confirm() === 'clear') this.history.set([]);
    if (this.confirm() === 'everywhere') this.signOut();
  }

  signOut(): void {
    this.session.signOut();
    this.router.navigateByUrl('/sesion-cerrada');
  }
}

import { Component, computed, inject, input, output, signal } from '@angular/core';
import { AdminApi } from '../../../core/api/admin-api';
import { errorMessage, mediaUrl } from '../../../core/api/api';
import { ChannelDetail } from '../../../core/api/models';
import { Dialog } from '../../../shared/ui/dialog';

/** Design: "Diálogo · Canal" (create / edit). */
@Component({
  selector: 'app-channel-dialog',
  imports: [Dialog],
  template: `
    <app-dialog eyebrow="CANALES" [heading]="create() ? 'Nuevo canal' : 'Editar canal'" (closed)="closed.emit()">
      <div class="flex gap-4 items-start">
        <label class="relative w-24 h-24 flex-none flex flex-col items-center justify-center gap-1 border border-dashed border-edge-2 rounded-[10px] cursor-pointer text-[11px] text-muted text-center overflow-hidden [background:repeating-linear-gradient(0deg,_rgba(255,255,255,0.04)_0_1px,_transparent_1px_3px),_#1F1F1B]">
          @if (preview()) {
            <img class="absolute inset-0 w-full h-full object-contain" [src]="preview()" alt="">
          } @else {
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFB547" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4"></path><path d="M7 9l5-5 5 5"></path><path d="M4 20h16"></path></svg>
            Logo
          }
          <input class="absolute w-px h-px opacity-0" type="file" accept="image/png,image/jpeg,image/webp" (change)="pick($any($event.target).files?.[0])">
        </label>
        <div class="flex-1 min-w-0 flex flex-col gap-3.5">
          <label class="flex flex-col gap-1.5 text-[12px] text-muted">Nombre del canal
            <input class="field" type="text" maxlength="200" [value]="name()" (input)="name.set($any($event.target).value)">
          </label>
          <div class="grid grid-cols-2 gap-2.5">
            <label class="flex flex-col gap-1.5 text-[12px] text-muted">Inicio
              <input class="field field-date" type="date" [value]="start()" (change)="start.set($any($event.target).value)">
            </label>
            <label class="flex flex-col gap-1.5 text-[12px] text-muted">Cierre (opcional)
              <input class="field field-date" type="date" [value]="end()" (change)="end.set($any($event.target).value)">
            </label>
          </div>
        </div>
      </div>
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Historia del canal
        <textarea class="field field-area" rows="4" maxlength="20000" [value]="history()" (input)="history.set($any($event.target).value)"></textarea>
      </label>
      @if (channel(); as c) {
        <div class="flex items-center gap-2.5 py-2.5 px-3 rounded-md bg-raised">
          <span class="flex-1 min-w-0 font-mono text-[12px] text-muted truncate">Enlace público: /canal/{{ c.id }} · ShareId {{ c.shareId }}</span>
        </div>
      }
      @if (error()) { <span class="text-[13px] text-danger" role="alert">{{ error() }}</span> }

      <ng-container footer>
        @if (!create()) {
          <button class="btn btn-danger-text" type="button" (click)="confirmDelete() ? remove() : confirmDelete.set(true)">{{ confirmDelete() ? 'Confirmar: eliminar canal' : 'Eliminar canal' }}</button>
        }
        <span class="flex-1"></span>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" [disabled]="busy() || !name().trim() || !start()" (click)="save()">{{ create() ? 'Crear canal' : 'Guardar cambios' }}</button>
      </ng-container>
    </app-dialog>
  `,
})
export class ChannelDialog {
  private readonly admin = inject(AdminApi);
  /** Null creates a new channel. */
  readonly channel = input<ChannelDetail | null>(null);
  readonly create = computed(() => this.channel() === null);
  readonly closed = output<void>();
  readonly saved = output<ChannelDetail>();
  readonly deleted = output<void>();

  readonly name = signal('');
  readonly start = signal(new Date().toISOString().slice(0, 10));
  readonly end = signal('');
  readonly history = signal('');
  readonly logo = signal<File | null>(null);
  readonly preview = signal<string | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly confirmDelete = signal(false);

  ngOnInit(): void {
    const c = this.channel();
    if (!c) return;
    this.name.set(c.name);
    this.start.set(c.startDate.slice(0, 10));
    this.end.set(c.endDate?.slice(0, 10) ?? '');
    this.history.set(c.history ?? '');
    this.preview.set(mediaUrl(c.logoPath));
  }

  pick(file: File | undefined): void {
    if (!file) return;
    this.logo.set(file);
    this.preview.set(URL.createObjectURL(file));
  }

  async save(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    const value = { name: this.name().trim(), history: this.history().trim() || null, startDate: this.start(), endDate: this.end() || null };
    try {
      const c = this.channel();
      this.saved.emit(c ? await this.admin.updateChannel(c.id, value, this.logo()) : await this.admin.createChannel(value, this.logo()));
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo guardar el canal.'));
    } finally {
      this.busy.set(false);
    }
  }

  async remove(): Promise<void> {
    const c = this.channel();
    if (!c) return;
    try {
      await this.admin.deleteChannel(c.id);
      this.deleted.emit();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo eliminar el canal.'));
    }
  }
}

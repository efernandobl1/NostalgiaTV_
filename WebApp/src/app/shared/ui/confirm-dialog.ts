import { Component, input, output } from '@angular/core';
import { Modal } from './modal';

/** Destructive / warning confirmation (design: "Diálogo · Confirmación"). */
@Component({
  selector: 'app-confirm-dialog',
  imports: [Modal],
  template: `
    <app-modal [width]="520" [alert]="true" (closed)="closed.emit()">
      <section class="w-full flex flex-col bg-panel border border-edge rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.55)] text-fg font-sans"
               role="alertdialog" aria-modal="true" [attr.aria-label]="heading()">
        <div class="flex gap-4 p-6">
          <span class="w-11 h-11 flex-none rounded-full flex items-center justify-center" aria-hidden="true"
                [class]="tone() === 'danger' ? 'bg-[#3A1F1B] text-danger' : 'bg-[#3A3122] text-amber'">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path></svg>
          </span>
          <div class="flex-1 flex flex-col gap-2">
            <h2 class="m-0 font-display text-[22px] font-semibold">{{ heading() }}</h2>
            <p class="m-0 text-[14px] leading-[1.55] text-fg-2">{{ message() }}</p>
          </div>
        </div>
        <footer class="flex flex-wrap justify-end gap-2.5 py-4 px-6 border-t border-line">
          <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
          <button class="btn" type="button" [class]="tone() === 'danger' ? 'btn btn-danger' : 'btn btn-primary'"
                  (click)="confirmed.emit(); closed.emit()">{{ confirmLabel() }}</button>
        </footer>
      </section>
    </app-modal>
  `,
})
export class ConfirmDialog {
  readonly heading = input.required<string>();
  readonly message = input('');
  readonly confirmLabel = input('Confirmar');
  readonly tone = input<'danger' | 'warning'>('danger');
  readonly closed = output<void>();
  readonly confirmed = output<void>();
}

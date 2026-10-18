import { Component, input, output } from '@angular/core';
import { Modal } from './modal';

/** Standard form dialog: eyebrow + title header, projected body and a `[footer]` slot. */
@Component({
  selector: 'app-dialog',
  imports: [Modal],
  template: `
    <app-modal [width]="width()" (closed)="closed.emit()">
      <section class="w-full flex flex-col bg-panel border border-edge rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.55)] text-fg font-sans"
               role="dialog" aria-modal="true" [attr.aria-label]="heading()">
        <header class="flex items-center gap-3 py-4 pr-4 pl-6 border-b border-line">
          <div class="flex-1 flex flex-col gap-0.5">
            <span class="font-mono text-[11px] tracking-[0.12em] text-muted">{{ eyebrow() }}</span>
            <h2 class="m-0 font-display text-[22px] font-semibold">{{ heading() }}</h2>
          </div>
          <button class="btn-icon" type="button" aria-label="Cerrar" (click)="closed.emit()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
          </button>
        </header>
        <div class="flex flex-col py-5 px-6" [class]="tight() ? 'gap-3' : 'gap-3.5'"><ng-content /></div>
        <footer class="flex flex-wrap items-center justify-end gap-2.5 py-4 px-6 border-t border-line">
          <ng-content select="[footer]" />
        </footer>
      </section>
    </app-modal>
  `,
})
export class Dialog {
  readonly eyebrow = input('');
  readonly heading = input.required<string>();
  readonly width = input(600);
  /** Body rows 12px apart instead of 14px (list-style dialogs). */
  readonly tight = input(false);
  readonly closed = output<void>();
}

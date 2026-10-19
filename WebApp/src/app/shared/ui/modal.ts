import { Component, input, output } from '@angular/core';

/** Dimmed overlay that centers a dialog. Closes on backdrop click and Escape. */
@Component({
  selector: 'app-modal',
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="fixed inset-0 z-50 flex justify-center items-start px-4 pb-12 overflow-y-auto bg-[rgba(6,6,5,0.78)]"
         [class.pt-12]="!alert()" [class.pt-30]="alert()" (click)="closed.emit()">
      <div class="w-full" [style.max-width.px]="width()" (click)="$event.stopPropagation()">
        <ng-content />
      </div>
    </div>
  `,
})
export class Modal {
  readonly width = input(600);
  /** Confirmation dialogs sit lower on the screen. */
  readonly alert = input(false);
  readonly closed = output<void>();
}

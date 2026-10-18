import { Component, input } from '@angular/core';

/** The amber TV mark used by the sidebar, public header and auth screens. */
@Component({
  selector: 'app-logo-mark',
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 36 36" fill="none" stroke="#FFB547" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="9" width="30" height="22" rx="4"></rect>
      <path d="M12 3l6 6 6-6"></path>
      <rect x="8" y="14" width="16" height="12" rx="2"></rect>
      <circle cx="28" cy="16" r="1.2"></circle>
      <circle cx="28" cy="22" r="1.2"></circle>
    </svg>
  `,
})
export class LogoMark {
  readonly size = input(36);
}

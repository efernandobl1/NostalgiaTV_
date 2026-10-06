import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TvModeService } from '../../core/services/tv-mode.service';

@Component({
  selector: 'app-internal-error',
  imports: [RouterLink],
  templateUrl: './internal-error.component.html',
  styleUrl: './internal-error.component.scss',
})
export class InternalErrorComponent {
  readonly tvMode = inject(TvModeService);
  retry(): void {
    window.history.length > 1 ? window.history.back() : window.location.assign('/');
  }
}

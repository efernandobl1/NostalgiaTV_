import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TvModeService } from '../../core/services/tv-mode.service';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
})
export class NotFoundComponent {
  readonly tvMode = inject(TvModeService);
}

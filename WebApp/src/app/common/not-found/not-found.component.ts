import { Component, HostBinding, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { TvModeService } from '../../core/services/tv-mode.service';

@Component({
    selector: 'app-not-found',
    imports: [RouterLink, MatCardModule, MatButtonModule],
    templateUrl: './not-found.component.html',
    styleUrl: './not-found.component.scss'
})
export class NotFoundComponent {
    readonly tvMode = inject(TvModeService);
    @HostBinding('class.tv-mode') get isTvMode(): boolean { return this.tvMode.enabled(); }
}

import { Component, computed, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TvModeService } from '../../core/services/tv-mode.service';

@Component({
    selector: 'app-not-found',
    imports: [RouterLink, NgClass],
    templateUrl: './not-found.component.html',
})
export class NotFoundComponent {
    private readonly tvMode = inject(TvModeService);
    private readonly router = inject(Router);

    /** En modo TV los textos y controles crecen (visión a 10 pies). */
    readonly tv = computed(() => this.tvMode.enabled());

    goHome(): void { this.router.navigateByUrl('/'); }
}

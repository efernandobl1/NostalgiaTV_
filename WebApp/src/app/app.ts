import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SeasonalAtmosphereComponent } from './shared/components/seasonal-atmosphere/seasonal-atmosphere.component';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, SeasonalAtmosphereComponent],
    templateUrl: './app.html',
    styleUrl: './app.scss'
})
export class App {}

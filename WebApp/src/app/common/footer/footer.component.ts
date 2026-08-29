import { Component } from '@angular/core';
import { CustomizerSettingsService } from '../../shared/components/customizer-settings/customizer-settings.service';

@Component({
    selector: 'app-footer',
    imports: [],
    templateUrl: './footer.component.html',
    styleUrl: './footer.component.scss'
})
export class FooterComponent {

    constructor(
        public themeService: CustomizerSettingsService
    ) {}

}

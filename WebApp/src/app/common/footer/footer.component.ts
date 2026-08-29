import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CustomizerSettingsService } from '../../shared/components/customizer-settings/customizer-settings.service';

@Component({
  selector: 'app-footer',
  imports: [],
  templateUrl: './footer.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  constructor(public themeService: CustomizerSettingsService) {}
}

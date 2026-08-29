import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoFilterProfile } from '../../../../core/services/tv-settings.service';


@Component({
  selector: 'app-retro-tv-filters-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './retro-tv-filters-panel.component.html',
  styleUrl: './retro-tv-filters-panel.component.scss',
})
export class RetroTvFiltersPanelComponent {
  isFullscreen = input<boolean>(false);
  activeFilters = input.required<VideoFilterProfile>();
  filtersEnabled = input<boolean>(true);

  updateFilter = output<{ key: string; value: boolean | number }>();
  filtersEnabledChange = output<boolean>();
  close = output<void>();
}

import { Component, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgClass } from '@angular/common';
import { SidebarComponent } from '../../common/sidebar/sidebar.component';
import { HeaderComponent } from '../../common/header/header.component';
import { FooterComponent } from '../../common/footer/footer.component';
import { CustomizerSettingsComponent } from '../../shared/components/customizer-settings/customizer-settings.component';
import { CustomizerSettingsService } from '../../shared/components/customizer-settings/customizer-settings.service';
import { ToggleService } from '../../common/sidebar/toggle.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    NgClass,
    SidebarComponent,
    HeaderComponent,
    FooterComponent,
    CustomizerSettingsComponent,
  ],
  template: `
    <div
      [class.card-borderd-theme]="themeService.isCardBorder()"
      [class.card-border-radius]="themeService.isCardBorderRadius()"
      [class.rtl-enabled]="themeService.isRTLEnabled()"
    >
      <app-sidebar />
      <div
        class="main-content transition d-flex flex-column"
        [ngClass]="{ active: isSidebarToggled }"
        [class.right-sidebar]="themeService.isRightSidebar()"
        [class.hide-sidebar]="themeService.isHideSidebar()"
      >
        <app-header />
        <router-outlet />
        <div class="flex-grow-1"></div>
        <app-footer />
      </div>
      <app-customizer-settings />
    </div>
  `,
  styleUrls: [
    './dashboard-layout.component.scss',
    '../../../_utilities.scss',
    '../../../_ui-kit.scss',
    '../../../_typography.scss',
    '../../../_rtl.scss',
    '../../../_dark.scss',
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  encapsulation: ViewEncapsulation.None,
})
export class DashboardLayoutComponent {
  isSidebarToggled = false;

  constructor(
    public themeService: CustomizerSettingsService,
    private toggleService: ToggleService,
  ) {
    this.toggleService.isSidebarToggled$.pipe(takeUntilDestroyed()).subscribe((val) => {
      this.isSidebarToggled = val;
    });
  }
}

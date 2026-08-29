import { Component, ChangeDetectionStrategy } from '@angular/core';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { MatExpansionModule } from '@angular/material/expansion';
import { RouterLink, RouterLinkActive, RouterModule } from '@angular/router';
import { ToggleService } from './toggle.service';
import { NgClass } from '@angular/common';
import { CustomizerSettingsService } from '../../shared/components/customizer-settings/customizer-settings.service';
import { MenuService } from '../../core/services/menu.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-sidebar',
  imports: [
    NgScrollbarModule,
    MatExpansionModule,
    RouterLinkActive,
    RouterModule,
    RouterLink,
    NgClass,
  ],
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  isSidebarToggled = false;
  isToggled = false;
  panelOpenState = false;

  constructor(
    private toggleService: ToggleService,
    public themeService: CustomizerSettingsService,
    public menuService: MenuService,
  ) {
    this.toggleService.isSidebarToggled$
      .pipe(takeUntilDestroyed())
      .subscribe((isSidebarToggled) => {
        this.isSidebarToggled = isSidebarToggled;
      });
    this.themeService.isToggled$.pipe(takeUntilDestroyed()).subscribe((isToggled) => {
      this.isToggled = isToggled;
    });
  }

  toggle() {
    this.toggleService.toggle();
  }
}

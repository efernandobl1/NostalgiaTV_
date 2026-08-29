import { NgClass } from '@angular/common';
import { MatMenuModule } from '@angular/material/menu';
import { Component, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { ToggleService } from '../sidebar/toggle.service';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { CustomizerSettingsService } from '../../shared/components/customizer-settings/customizer-settings.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-header',
  imports: [NgClass, MatMenuModule, MatButtonModule, RouterLink],
  templateUrl: './header.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  // isSidebarToggled
  isSidebarToggled = false;

  // isToggled
  isToggled = false;

  constructor(
    private toggleService: ToggleService,
    public themeService: CustomizerSettingsService,
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

  // Burger Menu Toggle
  toggle() {
    this.toggleService.toggle();
  }

  // Navbar Sticky
  isSticky: boolean = false;
  @HostListener('window:scroll')
  checkScroll() {
    const scrollPosition =
      window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    if (scrollPosition >= 50) {
      this.isSticky = true;
    } else {
      this.isSticky = false;
    }
  }

  // Dark Mode
  toggleTheme() {
    this.themeService.toggleTheme();
  }
}

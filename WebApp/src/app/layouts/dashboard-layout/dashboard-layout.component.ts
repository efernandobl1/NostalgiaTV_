import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { MenuService } from '../../core/services/menu.service';
import { CustomizerSettingsService } from '../../shared/components/customizer-settings/customizer-settings.service';

interface StudioDestination {
  label: string;
  icon: string;
  url: string;
  access: string[];
  admin?: boolean;
  secondary?: boolean;
}

@Component({
  selector: 'app-dashboard-layout',
  imports: [RouterOutlet, RouterLink, A11yModule],
  templateUrl: './dashboard-layout.component.html',
  styleUrl: './dashboard-layout.component.scss',
})
export class DashboardLayoutComponent {
  private readonly router = inject(Router);
  readonly menuService = inject(MenuService);
  readonly themeService = inject(CustomizerSettingsService);
  readonly menuOpen = signal(false);
  private readonly menuToggle = viewChild<ElementRef<HTMLButtonElement>>('menuToggle');
  private readonly studioContent = viewChild<ElementRef<HTMLElement>>('studioContent');
  readonly currentUrl = signal(this.router.url);
  readonly destinations: StudioDestination[] = [
    { label: 'Inicio', icon: 'space_dashboard', url: '/dashboard/summary', access: [] },
    {
      label: 'Canales',
      icon: 'live_tv',
      url: '/dashboard/channels',
      access: ['/dashboard/channels'],
    },
    {
      label: 'Videoteca',
      icon: 'video_library',
      url: '/dashboard/series',
      access: ['/dashboard/series'],
    },
    {
      label: 'Archivo publicitario',
      icon: 'theaters',
      url: '/dashboard/interludes',
      access: [],
      admin: true,
    },
    { label: 'Comunidad', icon: 'forum', url: '/dashboard/comments', access: [], admin: true },
    {
      label: 'Actividad',
      icon: 'history',
      url: '/dashboard/activity',
      access: [],
      secondary: true,
    },
    {
      label: 'Accesos',
      icon: 'badge',
      url: '/dashboard/users',
      access: ['/dashboard/users', '/dashboard/roles'],
      secondary: true,
    },
  ];
  readonly username = computed(() => this.menuService.currentUser()?.username ?? 'Usuario');
  readonly roleName = computed(() => this.menuService.currentUser()?.rol.name ?? '');
  readonly title = computed(
    () => this.destinations.find((item) => this.isCurrent(item))?.label ?? 'Estudio',
  );
  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects);
        if (this.menuOpen()) this.closeMenu();
      });
  }
  visibleItems(secondary = false): StudioDestination[] {
    return this.destinations.filter(
      (item) => !!item.secondary === secondary && this.canAccess(item),
    );
  }
  isCurrent(item: StudioDestination): boolean {
    const path = this.currentUrl().split('?')[0];
    if (item.url.endsWith('/channels'))
      return ['/dashboard/channels', '/dashboard/channel-eras'].includes(path);
    if (item.url.endsWith('/series'))
      return ['/dashboard/series', '/dashboard/episodes', '/dashboard/categories'].includes(path);
    if (item.url.endsWith('/interludes'))
      return ['/dashboard/interludes', '/dashboard/channel-bumpers'].includes(path);
    return path === item.url;
  }
  canAccess(item: StudioDestination): boolean {
    if (item.admin) return this.menuService.currentUser()?.rol.id === 1;
    if (!item.access.length) return true;
    const flatten = (menus: ReturnType<MenuService['menus']>): string[] =>
      menus.flatMap((menu) => [menu.url, ...flatten(menu.children ?? [])]);
    return item.access.some((url) => flatten(this.menuService.menus()).includes(url));
  }
  skipToContent(event: Event): void {
    event.preventDefault();
    this.studioContent()?.nativeElement.focus();
  }
  @HostListener('document:keydown.escape') closeMenu(): void {
    const wasOpen = this.menuOpen();
    this.menuOpen.set(false);
    if (wasOpen) this.menuToggle()?.nativeElement.focus({ preventScroll: true });
  }
}

import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { MenuService } from '../../core/services/menu.service';
import { CustomizerSettingsService } from '../../shared/components/customizer-settings/customizer-settings.service';

interface DashboardNavigationItem {
  label: string;
  compactLabel: string;
  icon: string;
  url: string;
  accessUrls: string[];
  section: 'primary' | 'tools';
}

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="dashboard-shell" [class.dashboard-shell--light]="!themeService.isDark()">
      <aside class="dashboard-sidebar" aria-label="Navegación del panel">
        <a routerLink="/dashboard/summary" class="dashboard-brand" aria-label="Ir al resumen">
          <img src="/images/logo-icon.svg" alt="">
          <span>NostalgiaTV</span>
        </a>
        <nav class="dashboard-navigation">
          <span class="dashboard-navigation__section">Navegación</span>
          @for (item of visibleItems('primary'); track item.url) {
            <a [routerLink]="item.url" [class.is-active]="isCurrent(item)" class="dashboard-navigation__item">
              <span class="material-symbols-outlined" aria-hidden="true">{{ item.icon }}</span>
              <span class="dashboard-navigation__label">{{ item.label }}</span>
              <span class="dashboard-navigation__compact-label">{{ item.compactLabel }}</span>
            </a>
          }
          <details class="dashboard-tools">
            <summary>Más herramientas</summary>
            @for (item of visibleItems('tools'); track item.url) {
              <a [routerLink]="item.url" [class.is-active]="isCurrent(item)" class="dashboard-navigation__item">
                <span class="material-symbols-outlined" aria-hidden="true">{{ item.icon }}</span>
                <span class="dashboard-navigation__label">{{ item.label }}</span>
                <span class="dashboard-navigation__compact-label">{{ item.compactLabel }}</span>
              </a>
            }
          </details>
        </nav>
        <div class="dashboard-sidebar__footer">
          <button type="button" class="dashboard-navigation__item dashboard-theme-button" (click)="toggleTheme()">
            <span class="material-symbols-outlined" aria-hidden="true">contrast</span>
            <span class="dashboard-navigation__label">Modo claro / oscuro</span>
            <span class="dashboard-navigation__compact-label">Tema</span>
          </button>
          <a routerLink="/dashboard/logout" class="dashboard-navigation__item dashboard-navigation__item--logout">
            <span class="material-symbols-outlined" aria-hidden="true">logout</span>
            <span class="dashboard-navigation__label">Salir</span>
            <span class="dashboard-navigation__compact-label">Salir</span>
          </a>
        </div>
      </aside>

      <div class="dashboard-workspace">
        <header class="dashboard-header">
          <div class="dashboard-location">
            <span>{{ currentSection() }}</span>
            <strong>{{ currentTitle() }}</strong>
          </div>
          <div class="dashboard-header__actions">
            <button type="button" class="dashboard-icon-button" aria-label="Abrir comandos" (click)="commandOpen.set(true)">
              <span class="material-symbols-outlined">bolt</span>
              <span class="dashboard-command-label">Comandos</span>
              <kbd>Ctrl K</kbd>
            </button>
            <div class="dashboard-user" [attr.aria-label]="'Sesión de ' + username()">
              <span>{{ initials() }}</span>
              <strong>{{ username() }} · {{ roleName() }}</strong>
            </div>
          </div>
        </header>
        <main class="dashboard-content"><router-outlet /></main>
      </div>

      <nav class="dashboard-mobile-nav" aria-label="Navegación móvil">
        @for (item of mobilePrimaryItems; track item.url) {
          <a [routerLink]="item.url" [class.is-active]="isCurrent(item)">
            <span class="material-symbols-outlined">{{ item.icon }}</span>
            <span>{{ item.compactLabel }}</span>
          </a>
        }
        <button type="button" [class.is-active]="moreOpen()" (click)="moreOpen.set(!moreOpen())">
          <span class="material-symbols-outlined">more_horiz</span>
          <span>Más</span>
        </button>
      </nav>

      @if (moreOpen()) {
        <button class="dashboard-more-backdrop" type="button" aria-label="Cerrar más módulos" (click)="moreOpen.set(false)"></button>
        <section class="dashboard-more-sheet" aria-label="Más módulos">
          <span class="dashboard-more-sheet__handle" aria-hidden="true"></span>
          <h2>Más módulos</h2>
          @for (item of mobileMoreItems(); track item.url) {
            <a [routerLink]="item.url" (click)="moreOpen.set(false)">
              <span class="material-symbols-outlined">{{ item.icon }}</span><span>{{ item.label }}</span>
            </a>
          }
          <button type="button" (click)="toggleTheme()">
            <span class="material-symbols-outlined">contrast</span><span>Modo claro / oscuro</span>
          </button>
          <a routerLink="/dashboard/logout" class="dashboard-more-sheet__logout">
            <span class="material-symbols-outlined">logout</span><span>Salir</span>
          </a>
        </section>
      }
      @if (commandOpen()) {
        <button class="dashboard-command-backdrop" type="button" aria-label="Cerrar comandos" (click)="commandOpen.set(false)"></button>
        <section class="dashboard-command-palette" role="dialog" aria-modal="true" aria-labelledby="command-title">
          <header><span class="material-symbols-outlined">bolt</span><h2 id="command-title">Comandos rápidos</h2><kbd>Esc</kbd></header>
          <nav aria-label="Acciones rápidas">
            @for (item of navigationItems; track item.url) {
              @if (canAccess(item)) {
                <a [routerLink]="item.url" (click)="commandOpen.set(false)"><span class="material-symbols-outlined">{{ item.icon }}</span><span>{{ item.label }}</span><span class="material-symbols-outlined">arrow_forward</span></a>
              }
            }
          </nav>
        </section>
      }
    </div>
  `,
  styleUrl: './dashboard-layout.component.scss',
})
export class DashboardLayoutComponent {
  private readonly router = inject(Router);
  readonly menuService = inject(MenuService);
  readonly themeService = inject(CustomizerSettingsService);
  readonly moreOpen = signal(false);
  readonly commandOpen = signal(false);
  readonly currentUrl = signal(this.router.url);

  readonly navigationItems: DashboardNavigationItem[] = [
    { label: 'Inicio', compactLabel: 'Inicio', icon: 'home', url: '/dashboard/summary', accessUrls: [], section: 'primary' },
    { label: 'Canales', compactLabel: 'Canales', icon: 'live_tv', url: '/dashboard/channels', accessUrls: ['/dashboard/channels', '/dashboard/channel-eras', '/dashboard/channel-bumpers'], section: 'primary' },
    { label: 'Series', compactLabel: 'Series', icon: 'movie', url: '/dashboard/series', accessUrls: ['/dashboard/series', '/dashboard/episodes'], section: 'primary' },
    { label: 'Actividad', compactLabel: 'Actividad', icon: 'history', url: '/dashboard/activity', accessUrls: [], section: 'primary' },
    { label: 'Eras', compactLabel: 'Eras', icon: 'schedule', url: '/dashboard/channel-eras', accessUrls: ['/dashboard/channel-eras'], section: 'tools' },
    { label: 'Bumpers', compactLabel: 'Bumpers', icon: 'theaters', url: '/dashboard/channel-bumpers', accessUrls: ['/dashboard/channel-bumpers'], section: 'tools' },
    { label: 'Episodios', compactLabel: 'Episodios', icon: 'video_library', url: '/dashboard/episodes', accessUrls: ['/dashboard/episodes'], section: 'tools' },
    { label: 'Categorías', compactLabel: 'Categorías', icon: 'sell', url: '/dashboard/categories', accessUrls: ['/dashboard/categories'], section: 'tools' },
    { label: 'Usuarios y roles', compactLabel: 'Accesos', icon: 'group', url: '/dashboard/users', accessUrls: ['/dashboard/users', '/dashboard/roles'], section: 'tools' },
  ];

  readonly mobilePrimaryItems = this.navigationItems.slice(0, 3);
  readonly mobileMoreItems = computed(() => this.navigationItems.slice(3).filter(item => this.canAccess(item)));
  readonly user = computed(() => this.menuService.currentUser());
  readonly username = computed(() => this.user()?.username ?? 'Administrador');
  readonly roleName = computed(() => this.user()?.rol.name ?? 'Admin');
  readonly initials = computed(() => this.username().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase());
  readonly currentTitle = computed(() => {
    const url = this.currentUrl();
    return this.navigationItems.find(item => url.startsWith(item.url))?.label
      ?? (url.includes('/episodes') ? 'Series y episodios'
        : url.includes('/channel-eras') ? 'Canales y eras'
        : url.includes('/channel-bumpers') ? 'Bumpers'
        : url.includes('/roles') ? 'Usuarios y roles'
        : 'Inicio');
  });
  readonly currentSection = computed(() =>
    ['/dashboard/users', '/dashboard/roles', '/dashboard/categories', '/dashboard/episodes',
      '/dashboard/channel-eras', '/dashboard/channel-bumpers'].some(path => this.currentUrl().startsWith(path))
      ? 'Herramientas'
      : 'Panel',
  );

  constructor() {
    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(event => {
      this.currentUrl.set(event.urlAfterRedirects);
      this.moreOpen.set(false);
    });
  }

  visibleItems(section: 'primary' | 'tools'): DashboardNavigationItem[] {
    return this.navigationItems.filter(item => item.section === section && this.canAccess(item));
  }

  isCurrent(item: DashboardNavigationItem): boolean {
    const path = this.currentUrl().split('?')[0];
    if (item.section === 'primary' && item.url === '/dashboard/channels')
      return ['/dashboard/channels', '/dashboard/channel-eras', '/dashboard/channel-bumpers'].includes(path);
    if (item.section === 'primary' && item.url === '/dashboard/series')
      return ['/dashboard/series', '/dashboard/episodes'].includes(path);
    return path === item.url;
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.commandOpen.set(!this.commandOpen());
    } else if (event.key === 'Escape') {
      this.commandOpen.set(false);
      this.moreOpen.set(false);
    }
  }

  canAccess(item: DashboardNavigationItem): boolean {
    if (item.accessUrls.length === 0) return true;
    const flatten = (menus: ReturnType<MenuService['menus']>): string[] =>
      menus.flatMap(menu => [menu.url, ...flatten(menu.children ?? [])]);
    const allowed = flatten(this.menuService.menus());
    return item.accessUrls.some(url => allowed.includes(url));
  }
}

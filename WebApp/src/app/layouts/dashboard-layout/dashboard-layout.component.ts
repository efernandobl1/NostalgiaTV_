import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { MenuService } from '../../core/services/menu.service';
import { CustomizerSettingsService } from '../../shared/components/customizer-settings/customizer-settings.service';

interface DashboardNavigationItem {
  label: string;
  compactLabel: string;
  icon: string;
  url: string;
  accessUrls: string[];
  section: 'broadcast' | 'access';
}

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="dashboard-shell" [class.dashboard-shell--light]="!themeService.isDark()">
      <aside class="dashboard-sidebar" aria-label="Navegación del panel">
        <a routerLink="/dashboard/summary" class="dashboard-brand" aria-label="Ir al resumen">
          <img src="/images/logo-icon.svg" alt="">
          <span>NostalgiaTV</span>
        </a>
        <nav class="dashboard-navigation">
          @for (section of sections; track section.key) {
            <span class="dashboard-navigation__section">{{ section.label }}</span>
            @for (item of visibleItems(section.key); track item.url) {
              <a [routerLink]="item.url" routerLinkActive="is-active" class="dashboard-navigation__item">
                <span class="material-symbols-outlined" aria-hidden="true">{{ item.icon }}</span>
                <span class="dashboard-navigation__label">{{ item.label }}</span>
                <span class="dashboard-navigation__compact-label">{{ item.compactLabel }}</span>
              </a>
            }
          }
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
          <div>
            <span>{{ currentSection() }}</span>
            <h1>{{ currentTitle() }}</h1>
          </div>
          <div class="dashboard-header__actions">
            <button type="button" class="dashboard-icon-button" aria-label="Abrir comandos" (click)="commandOpen.set(true)">
              <span class="material-symbols-outlined">bolt</span>
              <span class="dashboard-command-label">Comandos</span>
              <kbd>Ctrl K</kbd>
            </button>
            <button type="button" class="dashboard-icon-button" aria-label="Notificaciones">
              <span class="material-symbols-outlined">notifications</span>
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
          <a [routerLink]="item.url" routerLinkActive="is-active">
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

  readonly sections = [
    { key: 'broadcast' as const, label: 'EMISIÓN' },
    { key: 'access' as const, label: 'ACCESOS' },
  ];

  readonly navigationItems: DashboardNavigationItem[] = [
    { label: 'Resumen', compactLabel: 'Resumen', icon: 'dashboard', url: '/dashboard/summary', accessUrls: [], section: 'broadcast' },
    { label: 'Canales y eras', compactLabel: 'Canales', icon: 'live_tv', url: '/dashboard/channels', accessUrls: ['/dashboard/channels', '/dashboard/channel-eras'], section: 'broadcast' },
    { label: 'Series y episodios', compactLabel: 'Series', icon: 'movie', url: '/dashboard/series', accessUrls: ['/dashboard/series', '/dashboard/episodes'], section: 'broadcast' },
    { label: 'Bumpers', compactLabel: 'Bumpers', icon: 'theaters', url: '/dashboard/channel-bumpers', accessUrls: ['/dashboard/channel-bumpers'], section: 'broadcast' },
    { label: 'Categorías', compactLabel: 'Categ.', icon: 'sell', url: '/dashboard/categories', accessUrls: ['/dashboard/categories'], section: 'broadcast' },
    { label: 'Usuarios y roles', compactLabel: 'Accesos', icon: 'group', url: '/dashboard/users', accessUrls: ['/dashboard/users', '/dashboard/roles'], section: 'access' },
    { label: 'Actividad', compactLabel: 'Activid.', icon: 'history', url: '/dashboard/activity', accessUrls: [], section: 'access' },
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
        : 'Resumen');
  });
  readonly currentSection = computed(() =>
    ['/dashboard/users', '/dashboard/roles', '/dashboard/activity'].some(path => this.currentUrl().startsWith(path))
      ? 'Accesos'
      : 'Panel',
  );

  constructor() {
    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(event => {
      this.currentUrl.set(event.urlAfterRedirects);
      this.moreOpen.set(false);
    });
  }

  visibleItems(section: 'broadcast' | 'access'): DashboardNavigationItem[] {
    return this.navigationItems.filter(item => item.section === section && this.canAccess(item));
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

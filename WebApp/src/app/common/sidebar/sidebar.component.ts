import { Component, computed } from '@angular/core';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { MenuResponse } from '../../shared/models/menu.model';
import { MatExpansionModule } from '@angular/material/expansion';
import { RouterLink, RouterLinkActive, RouterModule } from '@angular/router';
import { ToggleService } from './toggle.service';
import { NgClass } from '@angular/common';
import { CustomizerSettingsService } from '../../shared/components/customizer-settings/customizer-settings.service';
import { MenuService } from '../../core/services/menu.service';

@Component({
    selector: 'app-sidebar',
    imports: [NgScrollbarModule, MatExpansionModule, RouterLinkActive, RouterModule, RouterLink, NgClass],
    templateUrl: './sidebar.component.html',
    styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {

    isSidebarToggled = false;
    isToggled = false;
    panelOpenState = false;

    // Menús que se ocultan del sidebar porque su flujo se absorbió en otra página
    // (Eras → dentro de Canales, Categorías → creación inline en Series). Sólo se
    // ocultan visualmente: menuGuard sigue usando la lista completa, así que los
    // permisos por rol no cambian y las páginas siguen accesibles desde su flujo.
    private readonly hiddenUrls = new Set<string>([
        '/dashboard/channel-eras',      // dentro de Canales (por canal)
        '/dashboard/channel-bumpers',   // dentro de Eras (por era)
        '/dashboard/categories',        // creación inline desde Series
        '/dashboard/episodes',          // dentro de Series (por serie)
    ]);

    // Vista filtrada del menú: quita los items ocultos y descarta las secciones
    // que quedan sin hijos.
    visibleMenus = computed<MenuResponse[]>(() =>
        this.menuService.menus().reduce<MenuResponse[]>((acc, menu) => {
            if ((menu.children?.length ?? 0) > 0) {
                const children = menu.children.filter(c => !this.hiddenUrls.has(c.url));
                if (children.length > 0) acc.push({ ...menu, children });
            } else if (!this.hiddenUrls.has(menu.url)) {
                acc.push(menu);
            }
            return acc;
        }, []),
    );

    constructor(
        private toggleService: ToggleService,
        public themeService: CustomizerSettingsService,
        public menuService: MenuService
    ) {
        this.toggleService.isSidebarToggled$.subscribe(isSidebarToggled => {
            this.isSidebarToggled = isSidebarToggled;
        });
        this.themeService.isToggled$.subscribe(isToggled => {
            this.isToggled = isToggled;
        });
    }

    toggle() {
        this.toggleService.toggle();
    }
}

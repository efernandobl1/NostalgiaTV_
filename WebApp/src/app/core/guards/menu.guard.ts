import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MenuService } from '../services/menu.service';
import { MenuResponse } from '../../shared/models/menu.model';

export const menuGuard: CanActivateFn = (route, state) => {
    const menuService = inject(MenuService);
    const router = inject(Router);

    const url = state.url.split('?')[0];

    const hasAccess = hasMenuAccess(menuService.menus(), url);

    if (!hasAccess) {
        router.navigate(['/dashboard']);
        return false;
    }

    return true;
};

function hasMenuAccess(menus: MenuResponse[], url: string): boolean {
    return menus.some(m => {
        if (m.url === url) return true;
        if (m.children?.length > 0) return hasMenuAccess(m.children, url);
        return false;
    });
}

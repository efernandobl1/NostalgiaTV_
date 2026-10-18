import { Route, Routes } from '@angular/router';
import { routes } from './app.routes';

/** Resolves every lazy route so a broken import fails CI instead of production navigation. */
async function collect(list: Routes, prefix = ''): Promise<string[]> {
  const paths: string[] = [];
  for (const route of list as Route[]) {
    const path = [prefix, route.path].filter(Boolean).join('/');
    if (route.loadComponent) expect(await route.loadComponent()).toBeTruthy();
    if (route.component || route.loadComponent || route.redirectTo !== undefined) paths.push('/' + path);
    const children = route.children ?? (route.loadChildren ? ((await route.loadChildren()) as Routes) : []);
    paths.push(...await collect(children, path));
  }
  return paths;
}

describe('app routes', () => {
  it('loads every screen of the design', async () => {
    const paths = await collect(routes);
    for (const expected of ['/', '/series/:id', '/canal/:id', '/ver/:id/pantalla-completa', '/guia', '/perfil', '/vincular',
      '/login', '/registro', '/recuperar', '/nueva-contrasena', '/sesion-cerrada', '/bloqueo', '/error', '/**',
      '/admin', '/admin/programacion', '/admin/ajustes', '/tv', '/tv/ver/:id', '/tv/guia']) {
      expect(paths).toContain(expected);
    }
  });
});

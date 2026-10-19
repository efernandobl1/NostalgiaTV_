import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from './sidebar';

/** Dashboard shell: 248px sidebar + content column (max 1240px). */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, Sidebar],
  template: `
    <div class="min-h-screen flex flex-wrap bg-ink text-fg font-sans">
      <div class="flex-[1_1_248px] max-w-[248px] border-r border-raised-2 max-lg:max-w-none"><app-sidebar /></div>
      <main class="flex-[999_1_560px] min-w-0 pt-8 px-10 pb-14 max-w-310 max-sm:px-4">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AdminLayout {}

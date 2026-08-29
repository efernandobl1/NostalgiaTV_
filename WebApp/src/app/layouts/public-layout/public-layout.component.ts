import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet],
  template: `
        <main>
            <router-outlet />
        </main>
    `
})
export class PublicLayoutComponent { }

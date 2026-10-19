import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  host: { class: 'block min-h-dvh' },
  template: '<router-outlet />',
})
export class App {}

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-authentication',
  imports: [RouterOutlet],
  templateUrl: './authentication.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './authentication.component.scss',
})
export class AuthenticationComponent {}

import { Component } from '@angular/core';
import { RetroTvComponent } from "../../../shared/components/retro-tv/retro-tv.component";

@Component({
  selector: 'app-home',
  imports: [RetroTvComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {}

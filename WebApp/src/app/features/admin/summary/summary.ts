import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeader } from '../../../shared/ui/page-header';
import { SUMMARY } from './summary.data';

@Component({
  selector: 'app-summary',
  imports: [RouterLink, PageHeader],
  host: { class: 'flex flex-col gap-7' },
  templateUrl: './summary.html',
})
export class Summary {
  readonly d = SUMMARY;
}

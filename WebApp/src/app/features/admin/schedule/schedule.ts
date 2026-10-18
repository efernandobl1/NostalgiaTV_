import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeader } from '../../../shared/ui/page-header';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { CHANNELS } from '../../../core/data/channels';
import { PROGRAMS, RULES, segRows } from './schedule.data';

@Component({
  selector: 'app-schedule',
  imports: [RouterLink, PageHeader, ConfirmDialog],
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './schedule.html',
})
export class Schedule {
  readonly channels = CHANNELS;
  readonly programs = PROGRAMS;
  readonly rules = RULES;
  readonly channel = signal(0);
  readonly program = signal(2);
  readonly regenOpen = signal(false);
  readonly sel = computed(() => PROGRAMS[this.program()]);
  readonly segRows = computed(() => segRows(this.sel().start));
}

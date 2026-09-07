import { MatTooltipModule } from '@angular/material/tooltip';
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SeriesResponse } from '../../../shared/models/serie.model';
import { CategoryResponse } from '../../../shared/models/category.model';
import { ChannelResponse } from '../../../shared/models/channel.model';
import { SeriesService } from './series.service';
import { CategoriesService } from '../categories/categories.service';
import { ChannelsService } from '../channels/channels.service';
import { EpisodesComponent } from '../episodes/episodes.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-series-editor',
  imports: [MatTooltipModule, ReactiveFormsModule, EpisodesComponent],
  templateUrl: './series-editor.component.html',
  styleUrl: './series-editor.component.scss',
})
export class SeriesEditorComponent implements OnInit {
  readonly series = input<SeriesResponse | null>(null);
  readonly initialTab = input<'data' | 'episodes'>('data');
  readonly closed = output<void>();
  readonly saved = output<SeriesResponse>();
  readonly tab = signal<'data' | 'episodes' | 'channels' | 'pending'>('data');
  readonly current = signal<SeriesResponse | null>(null);
  readonly categories = signal<CategoryResponse[]>([]);
  readonly channels = signal<ChannelResponse[]>([]);
  readonly selectedCategories = signal<number[]>([]);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly apiUrl = environment.apiUrl;
  private readonly service = inject(SeriesService);
  private readonly categoryService = inject(CategoriesService);
  private readonly channelService = inject(ChannelsService);
  private readonly fb = inject(FormBuilder);
  private logoFile?: File;
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(500)], history: ['', Validators.maxLength(1000)],
    startDate: ['', Validators.required], endDate: [''],
    rating: [0, [Validators.min(0), Validators.max(10)]],
    seasons: [1, [Validators.required, Validators.min(1)]],
  });

  ngOnInit(): void {
    const series = this.series();
    this.current.set(series);
    this.tab.set(this.initialTab());
    if (series) {
      this.form.patchValue({ name: series.name, description: series.description ?? '', history: series.history ?? '',
        startDate: series.startDate.slice(0, 10), endDate: series.endDate?.slice(0, 10) ?? '',
        rating: series.rating ?? 0, seasons: series.seasons ?? 1 });
      this.selectedCategories.set(series.categoryIds);
    }
    this.categoryService.getAll().subscribe({ next: items => this.categories.set(items), error: () => this.error.set('No se pudieron cargar las categorías. Vuelve a abrir el editor.') });
    this.channelService.getAll().subscribe({ next: items => this.channels.set(items), error: () => this.error.set('No se pudieron cargar los canales.') });
  }

  selectLogo(event: Event): void {
    this.logoFile = (event.target as HTMLInputElement).files?.[0];
    this.form.markAsDirty();
  }

  toggleCategory(id: number, checked: boolean): void {
    this.selectedCategories.update(ids => checked ? [...ids, id] : ids.filter(value => value !== id));
    this.form.markAsDirty();
  }

  save(): void {
    if (this.busy()) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); this.error.set('Revisa los campos obligatorios y los valores del formulario.'); return; }
    this.busy.set(true);
    this.error.set('');
    this.message.set('Guardando…');
    const payload = new FormData();
    for (const [key, value] of Object.entries(this.form.getRawValue())) payload.append(key, String(value));
    if (this.logoFile) payload.append('logo', this.logoFile);
    const current = this.current();
    (current ? this.service.update(current.id, payload) : this.service.create(payload)).subscribe({
      next: result => {
        this.current.set(result);
        this.saved.emit(result);
        this.service.assignCategories(result.id, this.selectedCategories()).subscribe({
          next: updated => { this.current.set(updated); this.saved.emit(updated); this.form.markAsPristine(); this.busy.set(false); this.message.set('Cambios guardados'); },
          error: () => { this.busy.set(false); this.message.set(''); this.error.set('La serie se guardó, pero sus categorías no. Pulsa Guardar cambios para reintentarlo.'); },
        });
      },
      error: () => { this.busy.set(false); this.message.set(''); this.error.set('No se pudo guardar la serie. Revisa los datos e inténtalo de nuevo.'); },
    });
  }

  channelNames(): string[] {
    const id = this.current()?.id;
    return this.channels().filter(channel => channel.seriesIds.includes(id!) || channel.eras.some(era => era.seriesIds.includes(id!))).map(channel => channel.name);
  }
}

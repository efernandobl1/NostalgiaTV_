import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import {
  BroadcastAdminService,
  ExternalId,
  ImportRun,
  MetadataProvider,
} from '../broadcast-admin.service';

@Component({
  selector: 'app-series-sources',
  imports: [FormsModule, DatePipe],
  template: `
    <section class="studio-page">
      <div>
        <h2>Fuentes de información</h2>
        <p>
          Vincula la serie con su identificador en una fuente externa. Este vínculo no descarga
          información automáticamente.
        </p>
      </div>
      @if (loading()) {
        <div class="admin-state" role="status">Cargando fuentes…</div>
      } @else {
        <div class="source-links">
          @for (link of links(); track link.id) {
            <div>
              <strong>{{ providerName(link.providerId) }}</strong
              ><span>Identificador: {{ link.externalId }}</span>
            </div>
          } @empty {
            <p>Esta serie no tiene fuentes vinculadas.</p>
          }
        </div>
        <form class="source-form" (ngSubmit)="link()">
          <label class="studio-field"
            >Fuente<select name="provider" [(ngModel)]="providerId" required>
              <option [ngValue]="null">Seleccionar fuente</option>
              @for (provider of providers(); track provider.id) {
                <option [ngValue]="provider.id">{{ provider.name }}</option>
              }
            </select></label
          ><label class="studio-field"
            >Identificador externo<input
              name="external"
              [(ngModel)]="externalId"
              maxlength="300"
              required /></label
          ><button
            class="admin-button"
            type="submit"
            [disabled]="busy() || !providerId || !externalId.trim()"
          >
            Vincular fuente
          </button>
        </form>
        <details class="provider-form">
          <summary>Añadir una fuente de información</summary>
          <form class="source-form" (ngSubmit)="addProvider()">
            <label class="studio-field"
              >Nombre<input
                name="name"
                [(ngModel)]="providerTitle"
                maxlength="200"
                required
                placeholder="Por ejemplo: TVmaze" /></label
            ><label class="studio-field"
              >Código<input
                name="code"
                [(ngModel)]="providerCode"
                maxlength="80"
                required
                placeholder="tvmaze" /></label
            ><button
              class="admin-button"
              type="submit"
              [disabled]="busy() || !providerTitle.trim() || !providerCode.trim()"
            >
              Crear fuente
            </button>
          </form>
        </details>
        <section class="admin-panel">
          <h3>Historial de importaciones</h3>
          @for (run of imports(); track run.id) {
            <p>{{ run.startedAtUtc | date: 'dd/MM/yyyy HH:mm' }} — {{ run.status }}</p>
          } @empty {
            <p>No se ha importado información para esta serie.</p>
          }
        </section>
      }
      @if (error()) {
        <p class="studio-error" role="alert">{{ error() }}</p>
      }
      @if (feedback()) {
        <p class="studio-feedback" role="status">{{ feedback() }}</p>
      }
    </section>
  `,
  styles: `
    @use '../../../../styles/dashboard-components';
    .source-form {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 16px;
      align-items: end;
      margin-top: 16px;
    }
    .source-links {
      display: grid;
      gap: 12px;
      > div {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        padding: 16px;
        border-left: 3px solid var(--dashboard-purple);
        background: var(--dashboard-bg);
        span {
          overflow-wrap: anywhere;
        }
      }
    }
    .provider-form {
      padding: 16px 0;
      border-top: 1px solid var(--dashboard-border);
      summary {
        cursor: pointer;
        min-height: 44px;
        padding-top: 10px;
      }
    }
    @media (max-width: 700px) {
      .source-form {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class SeriesSourcesComponent {
  readonly seriesId = input.required<number>();
  private readonly service = inject(BroadcastAdminService);
  readonly providers = signal<MetadataProvider[]>([]);
  readonly links = signal<ExternalId[]>([]);
  readonly imports = signal<ImportRun[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly feedback = signal('');
  providerId: number | null = null;
  externalId = '';
  providerTitle = '';
  providerCode = '';
  constructor() {
    effect(() => this.load(this.seriesId()));
  }
  load(id = this.seriesId()): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      providers: this.service.providers(),
      links: this.service.externalIds(id),
      imports: this.service.imports(id),
    }).subscribe({
      next: (result) => {
        if (id !== this.seriesId()) return;
        this.providers.set(result.providers);
        this.links.set(result.links);
        this.imports.set(result.imports);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudieron cargar las fuentes de información.');
      },
    });
  }
  providerName(id: number): string {
    return this.providers().find((provider) => provider.id === id)?.name ?? 'Fuente #' + id;
  }
  link(): void {
    if (!this.providerId || !this.externalId.trim() || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.service
      .linkExternalId(this.seriesId(), this.providerId, this.externalId.trim())
      .subscribe({
        next: (link) => {
          this.links.update((links) =>
            links.some((item) => item.id === link.id) ? links.map(item => item.id === link.id ? link : item) : [...links, link],
          );
          this.externalId = '';
          this.busy.set(false);
          this.feedback.set('Fuente vinculada');
        },
        error: () => {
          this.busy.set(false);
          this.error.set(
            'No se pudo vincular la fuente. Ese identificador puede pertenecer a otra serie.',
          );
        },
      });
  }
  addProvider(): void {
    if (this.busy() || !this.providerTitle.trim() || !this.providerCode.trim()) return;
    this.busy.set(true);
    this.error.set('');
    this.service.addProvider(this.providerCode.trim(), this.providerTitle.trim()).subscribe({
      next: (provider) => {
        this.providers.update((providers) => [...providers, provider]);
        this.providerId = provider.id;
        this.providerTitle = '';
        this.providerCode = '';
        this.busy.set(false);
        this.feedback.set('Fuente creada');
      },
      error: () => {
        this.busy.set(false);
        this.error.set('No se pudo crear la fuente. Comprueba que el código no exista.');
      },
    });
  }
}

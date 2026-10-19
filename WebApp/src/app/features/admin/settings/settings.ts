import { Component, computed, inject, signal } from '@angular/core';
import { AdminApi } from '../../../core/api/admin-api';
import { errorMessage } from '../../../core/api/api';
import { CatalogItem, MetadataProviderItem, PlatformSettings, ResourcePolicy, RoleListItem } from '../../../core/api/models';
import { Session } from '../../../core/session';
import { PageHeader } from '../../../shared/ui/page-header';

type Flag = 'seasonalEffectsEnabled' | 'seasonalEpisodesEnabled' | 'seasonalInterludesEnabled' | 'seasonalThemesEnabled';
type Number = 'noRepeatWindowHours' | 'maxSpecialsPerDay' | 'maxSpecialsPerSeriesPerDay' | 'maxMoviesPerDay' | 'maxMoviesPerSeriesPerDay';
type Catalog = 'categories' | 'types' | 'providers';
interface CatalogView { key: Catalog; title: string; placeholder: string; items: { id: number; name: string; usage: number }[] }

const ZONES = ['America/Guatemala', 'America/Mexico_City', 'America/Bogota', 'America/Lima', 'America/Santiago', 'America/Argentina/Buenos_Aires', 'America/New_York', 'Europe/Madrid', 'UTC'];
const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const minuteOf = (value: string) => { const [h, m] = value.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const slug = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

@Component({
  selector: 'app-settings',
  imports: [PageHeader],
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './settings.html',
})
export class Settings {
  private readonly admin = inject(AdminApi);
  private readonly session = inject(Session);

  readonly form = signal<PlatformSettings | null>(null);
  readonly roles = signal<RoleListItem[]>([]);
  readonly resources = signal<ResourcePolicy | null>(null);
  readonly canMedia = this.session.canOpen('/admin/media');
  readonly error = signal('');
  readonly notice = signal('');
  readonly busy = signal(false);

  readonly zones = computed(() => { const tz = this.form()?.timeZoneId; return tz && !ZONES.includes(tz) ? [tz, ...ZONES] : ZONES; });
  readonly hours = computed(() => this.form()?.noRepeatWindowHours ?? 0);
  readonly seasonal = computed(() => {
    const f = this.form();
    return ([
      ['seasonalEffectsEnabled', 'Efectos de temporada', 'Nieve, calabazas y overlays en el reproductor'],
      ['seasonalEpisodesEnabled', 'Episodios de temporada', 'Prioriza especiales temáticos en la programación'],
      ['seasonalInterludesEnabled', 'Interludios de temporada', 'Usa bumpers y anuncios marcados Halloween / Navidad'],
      ['seasonalThemesEnabled', 'Temas visuales', 'Cambia la paleta del sitio público'],
    ] as [Flag, string, string][]).map(([key, label, hint]) => ({ key, label, hint, on: f?.[key] ?? false }));
  });

  // Media resource policy (only with access to Media).
  readonly dayCores = signal(1);
  readonly nightCores = signal(2);
  readonly nightEnabled = signal(false);
  readonly nightStart = signal('23:00');
  readonly nightEnd = signal('06:00');

  readonly categories = signal<CatalogItem[]>([]);
  readonly types = signal<CatalogItem[]>([]);
  readonly providers = signal<MetadataProviderItem[]>([]);
  readonly catalogs = computed<CatalogView[]>(() => [
    { key: 'categories', title: 'CATEGORÍAS', placeholder: 'Nueva categoría', items: this.categories().map(c => ({ id: c.id, name: c.name, usage: c.usageCount })) },
    { key: 'types', title: 'TIPOS DE EPISODIO', placeholder: 'Nuevo tipo', items: this.types().map(c => ({ id: c.id, name: c.name, usage: c.usageCount })) },
    { key: 'providers', title: 'PROVEEDORES DE METADATOS', placeholder: 'Nombre del proveedor', items: this.providers().map(p => ({ id: p.id, name: `${p.name} (${p.code})`, usage: p.seriesCount })) },
  ]);

  constructor() {
    this.load();
  }

  private async load(): Promise<void> {
    try {
      const [settings, roles] = await Promise.all([this.admin.settings(), this.admin.roles().catch(() => [] as RoleListItem[])]);
      this.form.set(settings);
      this.roles.set(roles);
      await this.loadCatalogs();
      if (this.canMedia) {
        const r = (await this.admin.media('all', 'pending', 1, 1)).resources;
        this.resources.set(r);
        this.dayCores.set(r.dayCores); this.nightCores.set(r.nightCores); this.nightEnabled.set(r.nightEnabled);
        this.nightStart.set(clock(r.nightStartMinute)); this.nightEnd.set(clock(r.nightEndMinute));
      }
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudieron cargar los ajustes.'));
    }
  }

  private async loadCatalogs(): Promise<void> {
    const [categories, types, providers] = await Promise.all([this.admin.categories(), this.admin.episodeTypes(), this.admin.providers()]);
    this.categories.set(categories);
    this.types.set(types);
    this.providers.set(providers);
  }

  set<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]): void {
    this.form.update(f => (f ? { ...f, [key]: value } : f));
    this.notice.set('');
  }

  setNumber(key: Number, value: string): void { this.set(key, Math.max(0, Math.round(Number(value) || 0))); }
  toggle(key: Flag): void { const f = this.form(); if (f) this.set(key, !f[key]); }

  async save(): Promise<void> {
    const f = this.form();
    if (!f) return;
    this.busy.set(true);
    this.error.set('');
    try {
      this.form.set(await this.admin.updateSettings(f));
      if (this.canMedia) {
        await this.admin.setResources({ dayCores: this.dayCores(), nightCores: this.nightCores(), nightEnabled: this.nightEnabled(), nightStartMinute: minuteOf(this.nightStart()), nightEndMinute: minuteOf(this.nightEnd()) });
      }
      this.notice.set('Ajustes guardados.');
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudieron guardar los ajustes.'));
    } finally {
      this.busy.set(false);
    }
  }

  async add(key: Catalog, input: HTMLInputElement): Promise<void> {
    const value = input.value.trim();
    if (!value) return;
    try {
      if (key === 'categories') await this.admin.createCategory(value);
      else if (key === 'types') await this.admin.createEpisodeType(value);
      else await this.admin.createProvider(slug(value), value);
      input.value = '';
      await this.loadCatalogs();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo agregar.'));
    }
  }

  async remove(key: Catalog, id: number): Promise<void> {
    try {
      if (key === 'categories') await this.admin.deleteCategory(id);
      else if (key === 'types') await this.admin.deleteEpisodeType(id);
      else await this.admin.deleteProvider(id);
      await this.loadCatalogs();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo eliminar (puede estar en uso).'));
    }
  }
}

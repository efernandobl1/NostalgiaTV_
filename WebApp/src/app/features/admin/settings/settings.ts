import { Component, signal } from '@angular/core';
import { PageHeader } from '../../../shared/ui/page-header';

@Component({
  selector: 'app-settings',
  imports: [PageHeader],
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './settings.html',
})
export class Settings {
  readonly hours = signal(24);
  readonly seasonal = [
    { label: 'Efectos de temporada', hint: 'Nieve, calabazas y overlays en el reproductor', on: true },
    { label: 'Episodios de temporada', hint: 'Prioriza especiales temáticos en la programación', on: true },
    { label: 'Interludios de temporada', hint: 'Usa bumpers y anuncios marcados Halloween / Navidad', on: true },
    { label: 'Temas visuales', hint: 'Cambia la paleta del sitio público', on: false },
  ];
  readonly catalogs = signal([
    { title: 'CATEGORÍAS', placeholder: 'Nueva categoría', items: ['Anime', 'Caricatura', 'Comedia', 'Acción', 'Aventura', 'Live action'] },
    { title: 'TIPOS DE EPISODIO', placeholder: 'Nuevo tipo', items: ['Episodio', 'Opening', 'Ending', 'Relleno', 'Especial', 'Película'] },
    { title: 'PROVEEDORES DE METADATOS', placeholder: 'Código del proveedor', items: ['TMDB', 'TheTVDB'] },
  ]);

  add(index: number, input: HTMLInputElement): void {
    const value = input.value.trim();
    if (!value) return;
    this.catalogs.update(cs => cs.map((c, i) => (i === index && !c.items.includes(value) ? { ...c, items: [...c.items, value] } : c)));
    input.value = '';
  }
}

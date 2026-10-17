// props: {"$preview":{"width":1440,"height":1300}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { hours: 24 };
  }
  renderVals() {
    return {
      hours: this.state.hours,
      setHours: (e) => this.setState({ hours: Number(e.target.value) }),
      seasonal: [
        { label: 'Efectos de temporada', hint: 'Nieve, calabazas y overlays en el reproductor', on: true },
        { label: 'Episodios de temporada', hint: 'Prioriza especiales temáticos en la programación', on: true },
        { label: 'Interludios de temporada', hint: 'Usa bumpers y anuncios marcados Halloween / Navidad', on: true },
        { label: 'Temas visuales', hint: 'Cambia la paleta del sitio público', on: false }
      ],
      catalogs: [
        { title: 'CATEGORÍAS', placeholder: 'Nueva categoría', items: ['Anime', 'Caricatura', 'Comedia', 'Acción', 'Aventura', 'Live action'] },
        { title: 'TIPOS DE EPISODIO', placeholder: 'Nuevo tipo', items: ['Episodio', 'Opening', 'Ending', 'Relleno', 'Especial', 'Película'] },
        { title: 'PROVEEDORES DE METADATOS', placeholder: 'Código del proveedor', items: ['TMDB', 'TheTVDB'] }
      ]
    };
  }
}

// props: {"$preview":{"width":390,"height":844}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { chip: 0, q: '', sortRating: false };
  }
  renderVals() {
    const defs = ['Todas', 'Anime', 'Caricatura', 'Comedia', '80s', '90s', 'Al aire', 'Viendo'];
    const data = [
      ['Dragon Ball Z', '1989–1996', '8.8', ['Anime', '80s', 'Al aire', 'Viendo'], 64],
      ['Digimon Adventure', '1999–2000', '8.0', ['Anime', '90s', 'Al aire'], 0],
      ['El Chavo del 8', '1973–1980', '8.6', ['Comedia', 'Al aire'], 0],
      ['Hey Arnold!', '1996–2004', '8.0', ['Caricatura', 'Comedia', '90s', 'Al aire'], 0],
      ['Los Caballeros del Zodiaco', '1986–1989', '8.4', ['Anime', '80s', 'Al aire'], 0],
      ['Los Simpson', '1989 –', '8.7', ['Caricatura', 'Comedia', '80s', 'Al aire'], 0],
      ['Las Tortugas Ninja', '1987–1996', '7.9', ['Caricatura', '80s'], 0],
      ['Pokémon', '1997 –', '7.6', ['Anime', '90s', 'Al aire', 'Viendo'], 21]
    ];
    const chips = defs.map((label, i) => {
      const on = i === this.state.chip;
      return {
        label, pressed: on ? 'true' : 'false', pick: () => this.setState({ chip: i }),
        style: 'flex: none; min-height: 40px; padding: 0 14px; border-radius: 20px; white-space: nowrap; font: 500 13px \'IBM Plex Sans\', sans-serif; '
          + (on ? 'border: 1px solid #FFB547; background: #FFB547; color: #1A1206;' : 'border: 1px solid #3A3A33; background: transparent; color: #ECE8DC;')
      };
    });
    const sel = defs[this.state.chip];
    const q = this.state.q.trim().toLowerCase();
    let list = data.filter((d) => (this.state.chip === 0 || d[3].indexOf(sel) >= 0) && (!q || d[0].toLowerCase().indexOf(q) >= 0));
    if (this.state.sortRating) list = list.slice().sort((a, b) => Number(b[2]) - Number(a[2]));
    const nav = [['Canales', 'MobHome.dc.html'], ['Guía', 'MobGuide.dc.html'], ['Series', 'MobCatalog.dc.html'], ['Vincular', 'MobPair.dc.html']].map(([label, href], i) => ({
      label, href,
      current: i === 2 ? 'page' : 'false',
      bar: i === 2 ? '#FFB547' : 'transparent',
      style: 'flex: 1; min-height: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: 12px; text-decoration: none; '
        + (i === 2 ? 'color: #FFB547; font-weight: 600;' : 'color: #A29E91;')
    }));
    return {
      chips, nav,
      series: list.map(([name, years, rating, tags, pct]) => ({ name, years, rating, pct, onAir: tags.indexOf('Al aire') >= 0 })),
      count: list.length,
      none: list.length === 0,
      q: this.state.q,
      setQ: (e) => this.setState({ q: e.target.value }),
      sortLabel: this.state.sortRating ? 'mejor calificadas' : 'A–Z',
      toggleSort: () => this.setState({ sortRating: !this.state.sortRating })
    };
  }
}

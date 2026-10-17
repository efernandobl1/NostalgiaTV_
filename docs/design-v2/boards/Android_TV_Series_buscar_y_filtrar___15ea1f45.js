// props: {"$preview":{"width":1920,"height":1080}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { chip: 0, focus: 'p0' };
  }
  renderVals() {
    const chipDefs = ['Todas', 'Anime', 'Caricatura', 'Comedia', '80s', '90s', 'Al aire'];
    const data = [
      ['Dragon Ball Z', '1989–1996', ['Anime', '80s', 'Al aire']],
      ['Digimon Adventure', '1999–2000', ['Anime', '90s', 'Al aire']],
      ['El Chavo del 8', '1973–1980', ['Comedia', 'Al aire']],
      ['Hey Arnold!', '1996–2004', ['Caricatura', 'Comedia', '90s', 'Al aire']],
      ['Los Caballeros del Zodiaco', '1986–1989', ['Anime', '80s', 'Al aire']],
      ['Los Simpson', '1989 –', ['Caricatura', 'Comedia', '80s', 'Al aire']],
      ['Las Tortugas Ninja', '1987–1996', ['Caricatura', '80s']],
      ['Pokémon', '1997 –', ['Anime', '90s', 'Al aire']]
    ];
    const f = this.state.focus;
    const ring = 'box-shadow: 0 0 0 4px #0B0B09, 0 0 0 8px #FFF3DA; transform: scale(1.05);';
    const chips = chipDefs.map((label, i) => {
      const on = i === this.state.chip;
      const focused = f === 'c' + i;
      return {
        label, pressed: on ? 'true' : 'false',
        pick: () => this.setState({ chip: i, focus: 'c' + i }),
        style: 'height: 64px; padding: 0 28px; border-radius: 32px; cursor: pointer; font: 600 22px \'IBM Plex Sans\', sans-serif; border: 0; '
          + (on ? 'background: #FFB547; color: #1A1206;' : 'background: rgba(236,232,220,0.1); color: #ECE8DC;')
          + (focused ? ring : '')
      };
    });
    const sel = chipDefs[this.state.chip];
    const list = data.filter((d) => this.state.chip === 0 || d[2].indexOf(sel) >= 0).slice(0, 6);
    return {
      chips,
      heading: this.state.chip === 0 ? 'Todas las series' : sel,
      count: list.length,
      focusSearch: () => this.setState({ focus: 's' }),
      searchStyle: 'width: 560px; height: 72px; display: flex; align-items: center; gap: 16px; padding: 0 28px; border-radius: 36px; border: 0; cursor: pointer; font: 500 22px \'IBM Plex Sans\', sans-serif; background: #1A1A16; color: #A29E91;'
        + (f === 's' ? ring : ''),
      posters: list.map(([name, years, tags], i) => ({
        name, years,
        onAir: tags.indexOf('Al aire') >= 0,
        pick: () => this.setState({ focus: 'p' + i }),
        style: 'display: flex; flex-direction: column; gap: 12px; padding: 0; border: 0; border-radius: 16px; background: transparent; cursor: pointer; font-family: inherit;'
          + (f === 'p' + i ? ' box-shadow: 0 0 0 4px #0B0B09, 0 0 0 8px #FFB547; transform: scale(1.05);' : '')
      }))
    };
  }
}

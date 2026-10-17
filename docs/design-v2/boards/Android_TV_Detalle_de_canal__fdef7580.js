// props: {"$preview":{"width":1920,"height":1080}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { focus: 'a0' };
  }
  renderVals() {
    const f = this.state.focus;
    const ring = ' box-shadow: 0 0 0 4px #0B0B09, 0 0 0 8px #FFF3DA; transform: scale(1.04);';
    const actions = [['▶  Sintonizar canal', true], ['Guía del canal', false]].map(([label, primary], i) => ({
      label,
      pick: () => this.setState({ focus: 'a' + i }),
      style: 'height: 76px; padding: 0 36px; border: 0; border-radius: 38px; cursor: pointer; font: 700 26px \'IBM Plex Sans\', sans-serif; '
        + (primary ? 'background: #FFB547; color: #1A1206;' : 'background: rgba(236,232,220,0.12); color: #ECE8DC;')
        + (f === 'a' + i ? ring : '')
    }));
    const eras = [['1991–1995', 'Inicios', '2 series'], ['1996–2001', 'Época dorada', '5 series · al aire', true], ['2002–2007', 'Era digital', '2 series'], ['2008 –', 'Revival', '1 serie']]
      .map(([years, name, info, live], i) => ({
        years, name, info,
        pick: () => this.setState({ focus: 'e' + i }),
        style: 'flex: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 24px; border-radius: 18px; cursor: pointer; font-family: inherit; text-align: left; '
          + (live ? 'background: #FFB547; color: #1A1206; border: 0;' : 'background: #1A1A16; color: #ECE8DC; border: 2px solid #2C2C27;')
          + (f === 'e' + i ? ring : '')
      }));
    return {
      actions, eras,
      next: [
        { time: '14:15', title: 'Dragon Ball Z', sub: 'T2 · E14 · ahora', color: '#FF8A80' },
        { time: '14:39', title: 'Pokémon', sub: 'T3 · E02', color: '#ECE8DC' },
        { time: '15:03', title: 'Digimon: La película', sub: 'Especial', color: '#ECE8DC' },
        { time: '16:32', title: 'Caballeros del Zodiaco', sub: 'T1 · E31', color: '#ECE8DC' }
      ]
    };
  }
}

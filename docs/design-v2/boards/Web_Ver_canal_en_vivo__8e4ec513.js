// props: {"$preview":{"width":1440,"height":1200}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { ch: 0, tab: 0 };
  }
  renderVals() {
    const list = [
      { num: '05', name: 'Canal 5 Retro', era: 'Época dorada 1996–2001', now: 'Dragon Ball Z', detail: 'T2 · E14 · El poder oculto de Gohan', pct: 34, nextUp: 'Pokémon · T3 · E02' },
      { num: '12', name: 'Cartoon Clásico', era: 'Fines de los 90', now: 'Hey Arnold!', detail: 'T1 · E07', pct: 71, nextUp: 'Los Simpson · T5 · E22' },
      { num: '23', name: 'Anime 90s', era: 'Tardes de anime', now: 'Los Caballeros del Zodiaco', detail: 'T1 · E31', pct: 12, nextUp: 'Digimon Adventure · T1 · E12' },
      { num: '31', name: 'Tarde de Sábado', era: 'Sábados 2003', now: 'Digimon: La película', detail: 'Especial', pct: 58, nextUp: 'Pokémon · T1 · E05' }
    ];
    const i = this.state.ch;
    const chips = list.map((c, k) => {
      const on = k === i;
      return {
        num: c.num, name: c.name, pressed: on ? 'true' : 'false', pick: () => this.setState({ ch: k }),
        style: 'flex: none; display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 0 16px; border-radius: 26px; cursor: pointer; font-family: inherit; '
          + (on ? 'border: 1px solid #FFB547; background: #24231C; color: #FFB547;' : 'border: 1px solid #2C2C27; background: #171714; color: #ECE8DC;')
      };
    });
    const tabs = ['Guía del canal', 'Comentarios'].map((label, k) => {
      const on = k === this.state.tab;
      return {
        label, selected: on ? 'true' : 'false', pick: () => this.setState({ tab: k }),
        style: 'flex: 1; min-height: 52px; border: 0; margin-bottom: -1px; background: transparent; cursor: pointer; font: 600 14px \'IBM Plex Sans\', sans-serif; '
          + (on ? 'color: #FFB547; border-bottom: 2px solid #FFB547;' : 'color: #A29E91; border-bottom: 2px solid transparent;')
      };
    });
    const guideRaw = [
      ['13:48', 'Hey Arnold!', 'T2 · E04', 'past'], ['14:15', 'Dragon Ball Z', 'T2 · E14 · ahora', 'now'],
      ['14:39', 'Pokémon', 'T3 · E02'], ['15:03', 'Digimon: La película', 'Especial'],
      ['16:32', 'Los Caballeros del Zodiaco', 'T1 · E31'], ['16:56', 'El Chavo del 8', 'T3 · E11'], ['17:20', 'Dragon Ball Z', 'T2 · E15']
    ];
    const guide = guideRaw.map(([time, title, sub, st]) => ({
      time, title, sub,
      timeColor: st === 'now' ? '#FF8A80' : st === 'past' ? '#8C887D' : '#ECE8DC',
      style: 'display: flex; gap: 12px; padding: 12px 10px; border-radius: 8px; ' + (st === 'now' ? 'background: #24231C; box-shadow: inset 3px 0 0 #FFB547;' : st === 'past' ? 'opacity: 0.6;' : '')
    }));
    return {
      ch: list[i], chips, tabs, guide,
      showGuide: this.state.tab === 0,
      showChat: this.state.tab === 1,
      prev: () => this.setState({ ch: (i + list.length - 1) % list.length }),
      next: () => this.setState({ ch: (i + 1) % list.length }),
      comments: [
        { ini: 'MA', user: 'maria.g', time: 'hace 5 min', body: 'Los cortes con el bumper de Ya viene son idénticos a como los recuerdo.' },
        { ini: 'JP', user: 'jpablo', time: 'hace 3 min', body: '¿Alguien más llegando de la escuela para ver esto?' },
        { ini: 'LU', user: 'lucia', time: 'hace 1 min', body: 'Ojalá pongan la película completa el sábado.' }
      ]
    };
  }
}

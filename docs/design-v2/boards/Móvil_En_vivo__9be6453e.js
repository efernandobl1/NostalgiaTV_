// props: {"$preview":{"width":390,"height":844}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { ch: 0, tab: 0 };
  }
  renderVals() {
    const list = [
      { num: '05', short: 'Canal 5', name: 'CANAL 5 RETRO', now: 'Dragon Ball Z', detail: 'T2 · E14 · termina 14:39', pct: 34 },
      { num: '12', short: 'Cartoon', name: 'CARTOON CLÁSICO', now: 'Hey Arnold!', detail: 'T1 · E07 · termina 14:40', pct: 71 },
      { num: '23', short: 'Anime 90s', name: 'ANIME 90S', now: 'Caballeros del Zodiaco', detail: 'T1 · E31 · termina 14:36', pct: 12 },
      { num: '31', short: 'Sábado', name: 'TARDE DE SÁBADO', now: 'Digimon: La película', detail: 'Especial · termina 15:00', pct: 58 }
    ];
    const chips = list.map((c, k) => {
      const on = k === this.state.ch;
      return {
        num: c.num, short: c.short, pressed: on ? 'true' : 'false', pick: () => this.setState({ ch: k }),
        style: 'flex: none; min-height: 40px; padding: 0 14px; border-radius: 20px; cursor: pointer; white-space: nowrap; font: 500 13px \'IBM Plex Sans\', sans-serif; '
          + (on ? 'border: 1px solid #FFB547; background: #FFB547; color: #1A1206;' : 'border: 1px solid #3A3A33; background: transparent; color: #ECE8DC;')
      };
    });
    const tabs = ['Guía', 'Comentarios'].map((label, k) => {
      const on = k === this.state.tab;
      return {
        label, selected: on ? 'true' : 'false', pick: () => this.setState({ tab: k }),
        style: 'flex: 1; min-height: 44px; border: 0; margin-bottom: -1px; background: transparent; font: 600 14px \'IBM Plex Sans\', sans-serif; '
          + (on ? 'color: #FFB547; border-bottom: 2px solid #FFB547;' : 'color: #A29E91; border-bottom: 2px solid transparent;')
      };
    });
    const guide = [['14:15', 'Dragon Ball Z', 'T2 · E14 · ahora', 1], ['14:39', 'Pokémon', 'T3 · E02'], ['15:03', 'Digimon: La película', 'Especial'], ['16:32', 'Caballeros del Zodiaco', 'T1 · E31'], ['16:56', 'El Chavo del 8', 'T3 · E11'], ['17:20', 'Dragon Ball Z', 'T2 · E15']]
      .map(([time, title, sub, now]) => ({
        time, title, sub,
        timeColor: now ? '#FF8A80' : '#ECE8DC',
        style: 'display: flex; gap: 12px; padding: 12px 8px; border-bottom: 1px solid #24241F;' + (now ? ' background: #24231C; box-shadow: inset 3px 0 0 #FFB547;' : '')
      }));
    const nav = [['Canales', 'MobHome.dc.html'], ['Guía', 'MobGuide.dc.html'], ['Series', 'MobCatalog.dc.html'], ['Vincular', 'MobPair.dc.html']].map(([label, href], i) => ({
      label, href,
      current: i === 0 ? 'page' : 'false',
      bar: i === 0 ? '#FFB547' : 'transparent',
      style: 'flex: 1; min-height: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: 12px; text-decoration: none; '
        + (i === 0 ? 'color: #FFB547; font-weight: 600;' : 'color: #A29E91;')
    }));
    return {
      ch: list[this.state.ch], chips, tabs, guide, nav,
      showGuide: this.state.tab === 0,
      showChat: this.state.tab === 1,
      comments: [
        { ini: 'MA', user: 'maria.g', time: 'hace 5 min', body: 'Los bumpers de Ya viene están idénticos.' },
        { ini: 'JP', user: 'jpablo', time: 'hace 3 min', body: '¿Alguien más llegando de la escuela?' }
      ]
    };
  }
}

// props: {"$preview":{"width":390,"height":844}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { f: 0 };
  }
  renderVals() {
    const filters = ['Todos', 'Al aire', 'Anime', 'Caricaturas', 'Comedia'].map((label, i) => {
      const on = i === this.state.f;
      return {
        label, pressed: on ? 'true' : 'false', pick: () => this.setState({ f: i }),
        style: 'flex: none; min-height: 40px; padding: 0 14px; border-radius: 20px; white-space: nowrap; font: 500 13px \'IBM Plex Sans\', sans-serif; '
          + (on ? 'border: 1px solid #FFB547; background: #FFB547; color: #1A1206;' : 'border: 1px solid #3A3A33; background: transparent; color: #ECE8DC;')
      };
    });
    const tabs = [['Canales', 'MobHome.dc.html'], ['Guía', 'MobGuide.dc.html'], ['Series', 'MobCatalog.dc.html'], ['Vincular', 'MobPair.dc.html']].map(([label, href], i) => ({
      label, href,
      current: i === 0 ? 'page' : 'false',
      bar: i === 0 ? '#FFB547' : 'transparent',
      style: 'flex: 1; min-height: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: 12px; text-decoration: none; '
        + (i === 0 ? 'color: #FFB547; font-weight: 600;' : 'color: #A29E91;')
    }));
    return {
      tabs, filters,
      channels: [
        { num: '05', name: 'Canal 5 Retro', now: 'Dragon Ball Z', pct: 34 },
        { num: '12', name: 'Cartoon Clásico', now: 'Hey Arnold!', pct: 71 },
        { num: '23', name: 'Anime 90s', now: 'Los Caballeros del Zodiaco', pct: 12 },
        { num: '31', name: 'Tarde de Sábado', now: 'Digimon: La película', pct: 58 }
      ],
      cont: [
        { series: 'Dragon Ball Z', code: 'T2 · E14 · quedan 8 min', pct: 64 },
        { series: 'Pokémon', code: 'T3 · E01 · quedan 17 min', pct: 21 },
        { series: 'Hey Arnold!', code: 'T1 · E08', pct: 0 }
      ]
    };
  }
}

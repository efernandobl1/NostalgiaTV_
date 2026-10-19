// props: {"$preview":{"width":390,"height":844}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { era: 1 };
  }
  renderVals() {
    const data = [
      { name: 'Inicios', years: '1991–1995', desc: 'Primeras caricaturas dobladas en bloques matutinos.', series: ['Caballeros del Zodiaco', 'El Chavo del 8'] },
      { name: 'Época dorada', years: '1996–2001', desc: 'Anime después de la escuela y los bumpers de «Ya viene». Al aire ahora.', series: ['Dragon Ball Z', 'Los Simpson', 'Hey Arnold!', 'Pokémon'] },
      { name: 'Era digital', years: '2002–2007', desc: 'Cambio de imagen y bumpers en 3D.', series: ['Digimon Adventure', 'Pokémon'] },
      { name: 'Revival', years: '2008 –', desc: 'Repeticiones y especiales de aniversario.', series: ['Dragon Ball Z'] }
    ];
    const eras = data.map((e, i) => {
      const on = i === this.state.era;
      return {
        ...e, pressed: on ? 'true' : 'false', pick: () => this.setState({ era: i }),
        style: 'flex: none; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 8px 14px; border-radius: 10px; font-family: inherit; '
          + (on ? 'border: 1px solid #FFB547; background: #FFB547; color: #1A1206;' : 'border: 1px solid #3A3A33; background: #171714; color: #ECE8DC;')
      };
    });
    const era = data[this.state.era];
    const nav = [['Canales', 'MobHome.dc.html'], ['Guía', 'MobGuide.dc.html'], ['Series', 'MobCatalog.dc.html'], ['Vincular', 'MobPair.dc.html']].map(([label, href], i) => ({
      label, href,
      current: i === 0 ? 'page' : 'false',
      bar: i === 0 ? '#FFB547' : 'transparent',
      style: 'flex: 1; min-height: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: 12px; text-decoration: none; '
        + (i === 0 ? 'color: #FFB547; font-weight: 600;' : 'color: #A29E91;')
    }));
    return {
      eras, era, nav,
      series: era.series,
      comments: [
        { user: 'lucia', time: 'hace 48 min', body: 'Los bumpers de Ya viene están idénticos.' },
        { user: 'maria.g', time: 'ayer', body: '¿Van a agregar la era de los 2000?' }
      ]
    };
  }
}

// props: {"$preview":{"width":390,"height":844}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { tab: 0 };
  }
  renderVals() {
    const tabs = ['Historial', 'Comentarios', 'Ajustes'].map((label, i) => {
      const on = i === this.state.tab;
      return {
        label, selected: on ? 'true' : 'false', pick: () => this.setState({ tab: i }),
        style: 'flex: 1; min-height: 44px; border: 0; margin-bottom: -1px; background: transparent; font: 600 14px \'IBM Plex Sans\', sans-serif; '
          + (on ? 'color: #FFB547; border-bottom: 2px solid #FFB547;' : 'color: #A29E91; border-bottom: 2px solid transparent;')
      };
    });
    const history = [['Dragon Ball Z', 'T2 · E14', 64, 'hoy'], ['Pokémon', 'T3 · E01', 21, 'ayer'], ['Hey Arnold!', 'T1 · E07', 100, 'hace 3 días'], ['Los Simpson', 'T5 · E20', 100, 'hace 5 días'], ['Digimon Adventure', 'T1 · E11', 45, 'hace 1 semana']]
      .map(([series, code, pct, when]) => ({
        series, code, pct, when,
        state: pct >= 100 ? '✓ COMPLETADO' : 'EN CURSO ' + pct + '%',
        color: pct >= 100 ? '#8BE08F' : '#FFB547'
      }));
    const nav = [['Canales', 'MobHome.dc.html'], ['Guía', 'MobGuide.dc.html'], ['Series', 'MobCatalog.dc.html'], ['Vincular', 'MobPair.dc.html']].map(([label, href], i) => ({
      label, href,
      current: i === 3 ? 'page' : 'false',
      bar: i === 3 ? '#FFB547' : 'transparent',
      style: 'flex: 1; min-height: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: 12px; text-decoration: none; '
        + (i === 3 ? 'color: #FFB547; font-weight: 600;' : 'color: #A29E91;')
    }));
    return {
      tabs, history, nav,
      showHistory: this.state.tab === 0,
      showComments: this.state.tab === 1,
      showSettings: this.state.tab === 2,
      myComments: [
        { target: 'Dragon Ball Z', status: 'PENDIENTE', color: '#FFB547', body: 'Me encanta que pusieran la saga de Namek completa.' },
        { target: 'Canal · Anime 90s', status: 'PUBLICADO', color: '#8BE08F', body: 'Podrían agregar más cortes comerciales en la tarde.' }
      ],
      settings: [
        { label: 'Reproducir con datos móviles', hint: 'Si está apagado, solo con Wi-Fi', on: true },
        { label: 'Mostrar número al cambiar de canal', hint: 'Número verde estilo TV de tubo', on: true },
        { label: 'Efectos de temporada', hint: 'Halloween y Navidad', on: true },
        { label: 'Subtítulos', hint: 'Cuando estén disponibles', on: false }
      ]
    };
  }
}

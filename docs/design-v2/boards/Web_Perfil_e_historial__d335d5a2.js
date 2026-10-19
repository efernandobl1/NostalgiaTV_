// props: {"$preview":{"width":1440,"height":1200}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { tab: 0, hf: 0 };
  }
  renderVals() {
    const tabs = ['Historial', 'Mis comentarios', 'Cuenta'].map((label, i) => {
      const on = i === this.state.tab;
      return {
        label, selected: on ? 'true' : 'false', pick: () => this.setState({ tab: i }),
        style: 'min-height: 48px; padding: 0 18px; border: 0; margin-bottom: -1px; background: transparent; cursor: pointer; font: 600 15px \'IBM Plex Sans\', sans-serif; '
          + (on ? 'color: #FFB547; border-bottom: 2px solid #FFB547;' : 'color: #A29E91; border-bottom: 2px solid transparent;')
      };
    });
    const hFilters = ['Todo', 'En curso', 'Completados'].map((label, i) => {
      const on = i === this.state.hf;
      return {
        label, pressed: on ? 'true' : 'false', pick: () => this.setState({ hf: i }),
        style: 'min-height: 40px; padding: 0 16px; border-radius: 20px; cursor: pointer; font: 500 14px \'IBM Plex Sans\', sans-serif; '
          + (on ? 'border: 1px solid #FFB547; background: #FFB547; color: #1A1206;' : 'border: 1px solid #3A3A33; background: transparent; color: #ECE8DC;')
      };
    });
    const all = [
      ['Dragon Ball Z', 'T2 · E14', 'El poder oculto de Gohan', 64, 'hoy 14:20'],
      ['Pokémon', 'T3 · E01', 'Episodio 1', 21, 'ayer'],
      ['Hey Arnold!', 'T1 · E07', 'Episodio 7', 100, 'hace 3 días'],
      ['Los Simpson', 'T5 · E20', 'Episodio 20', 100, 'hace 5 días'],
      ['Digimon Adventure', 'T1 · E11', 'Episodio 11', 45, 'hace 1 semana']
    ];
    const history = all
      .filter((h) => this.state.hf === 0 || (this.state.hf === 1 ? h[3] < 100 : h[3] >= 100))
      .map(([series, code, title, pct, when]) => ({
        series, code, title, pct, when,
        state: pct >= 100 ? '✓ COMPLETADO' : 'EN CURSO ' + pct + '%',
        color: pct >= 100 ? '#8BE08F' : '#FFB547',
        cta: pct >= 100 ? 'Ver de nuevo' : 'Continuar'
      }));
    return {
      tabs, hFilters, history,
      showHistory: this.state.tab === 0,
      showComments: this.state.tab === 1,
      showAccount: this.state.tab === 2,
      myComments: [
        { target: 'Serie · Dragon Ball Z', href: 'PubSeries.dc.html', time: 'hace 2 h', status: 'PENDIENTE DE MODERACIÓN', color: '#FFB547', body: 'Me encanta que pusieran la saga de Namek completa.' },
        { target: 'Canal · Anime 90s', href: 'PubChannel.dc.html', time: 'hace 4 días', status: 'PUBLICADO', color: '#8BE08F', body: 'Podrían agregar más cortes comerciales en la tarde.' },
        { target: 'Serie · Pokémon', href: 'PubSeries.dc.html', time: 'hace 2 semanas', status: 'RECHAZADO', color: '#FF8A80', body: '[Comentario rechazado por el moderador]' }
      ]
    };
  }
}

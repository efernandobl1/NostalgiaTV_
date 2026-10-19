// props: {"$preview":{"width":1440,"height":1600}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { season: 2 };
  }
  renderVals() {
    const seasons = ['Especiales', 'T1', 'T2', 'T3', 'T4'].map((label, i) => {
      const on = i === this.state.season;
      return {
        label, pressed: on ? 'true' : 'false', pick: () => this.setState({ season: i }),
        style: 'min-height: 40px; padding: 0 16px; border-radius: 20px; cursor: pointer; font: 500 14px \'IBM Plex Sans\', sans-serif; '
          + (on ? 'border: 1px solid #FFB547; background: #FFB547; color: #1A1206;' : 'border: 1px solid #3A3A33; background: transparent; color: #ECE8DC;')
      };
    });
    const raw = [
      ['E12', 'La batalla en Namek comienza', 100], ['E13', 'La llegada de Freezer', 100],
      ['E14', 'El poder oculto de Gohan', 64], ['E15', 'Vegeta contra Zarbon', 0],
      ['E16', 'Las esferas de Namek', 0], ['E17', 'Resumen de la saga', 0]
    ];
    const episodes = raw.map(([num, title, pct]) => ({
      num, title, pct,
      meta: '21 min · T2',
      state: pct >= 100 ? '✓ VISTO' : pct > 0 ? 'EN CURSO ' + pct + '%' : '',
      stateColor: pct >= 100 ? '#8BE08F' : '#FFB547'
    }));
    const base = 'display: flex; gap: 12px; padding: 14px 0; border-top: 1px solid #24241F;';
    return {
      seasons, episodes,
      comments: [
        { ini: 'MA', user: 'maria.g', time: 'hace 2 h', body: 'Me encanta que pusieran la saga de Namek completa, así la veía de niña después de la escuela.', style: base },
        { ini: 'JP', user: 'jpablo', time: 'hace 1 h', body: 'Igual yo. Falta el episodio 16 pero lo demás está perfecto.', style: base + ' margin-left: 48px;' },
        { ini: 'LU', user: 'lucia', time: 'ayer', body: '¿Van a agregar las películas como especiales?', style: base }
      ]
    };
  }
}

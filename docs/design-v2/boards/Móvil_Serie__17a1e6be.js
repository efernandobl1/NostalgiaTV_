// props: {"$preview":{"width":390,"height":844}}
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
        style: 'flex: none; min-height: 40px; padding: 0 14px; border-radius: 20px; cursor: pointer; font: 500 13px \'IBM Plex Sans\', sans-serif; '
          + (on ? 'border: 1px solid #FFB547; background: #FFB547; color: #1A1206;' : 'border: 1px solid #3A3A33; background: transparent; color: #ECE8DC;')
      };
    });
    const episodes = [['E12', 'La batalla en Namek comienza', 100], ['E13', 'La llegada de Freezer', 100], ['E14', 'El poder oculto de Gohan', 64], ['E15', 'Vegeta contra Zarbon', 0], ['E16', 'Las esferas de Namek', 0], ['E17', 'Resumen de la saga', 0]]
      .map(([num, title, pct]) => ({
        num, title, pct,
        state: pct >= 100 ? '✓ VISTO' : pct > 0 ? 'EN CURSO ' + pct + '%' : '21 MIN',
        stateColor: pct >= 100 ? '#8BE08F' : pct > 0 ? '#FFB547' : '#A29E91'
      }));
    const nav = [['Canales', 'MobHome.dc.html'], ['Guía', 'MobGuide.dc.html'], ['Series', 'MobCatalog.dc.html'], ['Vincular', 'MobPair.dc.html']].map(([label, href], i) => ({
      label, href,
      current: i === 2 ? 'page' : 'false',
      bar: i === 2 ? '#FFB547' : 'transparent',
      style: 'flex: 1; min-height: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: 12px; text-decoration: none; '
        + (i === 2 ? 'color: #FFB547; font-weight: 600;' : 'color: #A29E91;')
    }));
    return { seasons, episodes, nav };
  }
}

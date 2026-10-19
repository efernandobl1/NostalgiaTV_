// props: {"$preview":{"width":1920,"height":1080}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { focus: 'a0', season: 2 };
  }
  renderVals() {
    const f = this.state.focus;
    const ring = ' box-shadow: 0 0 0 4px #0B0B09, 0 0 0 8px #FFF3DA; transform: scale(1.04);';
    const actions = [['▶  Continuar T2 · E14', true], ['Sintonizar CH 05 (al aire)', false], ['Próximas emisiones', false]].map(([label, primary], i) => ({
      label,
      pick: () => this.setState({ focus: 'a' + i }),
      style: 'height: 76px; padding: 0 36px; border: 0; border-radius: 38px; cursor: pointer; font: 700 26px \'IBM Plex Sans\', sans-serif; '
        + (primary ? 'background: #FFB547; color: #1A1206;' : 'background: rgba(236,232,220,0.12); color: #ECE8DC;')
        + (f === 'a' + i ? ring : '')
    }));
    const seasons = ['Especiales', 'T1', 'T2', 'T3', 'T4'].map((label, i) => {
      const on = i === this.state.season;
      return {
        label,
        pick: () => this.setState({ season: i, focus: 's' + i }),
        style: 'height: 60px; padding: 0 28px; border: 0; border-radius: 30px; cursor: pointer; font: 600 22px \'IBM Plex Sans\', sans-serif; '
          + (on ? 'background: #ECE8DC; color: #0B0B09;' : 'background: transparent; color: #A29E91;')
          + (f === 's' + i ? ring : '')
      };
    });
    const episodes = [['E12', 'La batalla en Namek comienza', 100], ['E13', 'La llegada de Freezer', 100], ['E14', 'El poder oculto de Gohan', 64], ['E15', 'Vegeta contra Zarbon', 0], ['E16', 'Las esferas de Namek', 0]]
      .map(([num, title, pct], i) => ({
        num, title, pct,
        state: pct >= 100 ? '✓ VISTO' : pct > 0 ? 'EN CURSO ' + pct + '%' : '21 MIN',
        color: pct >= 100 ? '#8BE08F' : pct > 0 ? '#FFB547' : '#A29E91',
        pick: () => this.setState({ focus: 'e' + i }),
        style: 'width: 324px; flex: none; display: flex; flex-direction: column; gap: 10px; padding: 0; border: 0; border-radius: 12px; background: transparent; color: #ECE8DC; cursor: pointer; font-family: inherit;'
          + (f === 'e' + i ? ' box-shadow: 0 0 0 4px #0B0B09, 0 0 0 8px #FFB547; transform: scale(1.04);' : '')
      }));
    return { actions, seasons, episodes };
  }
}

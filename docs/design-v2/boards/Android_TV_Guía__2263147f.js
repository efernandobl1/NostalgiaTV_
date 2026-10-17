// props: {"$preview":{"width":1920,"height":1080}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { focus: '0-1' };
  }
  renderVals() {
    const data = [
      ['05', 'Canal 5 Retro', [[18, 'Hey Arnold!', '13:48', 'T2 · E04'], [24, 'Dragon Ball Z', '14:15', 'T2 · E14 · El poder oculto de Gohan'], [24, 'Pokémon', '14:39', 'T3 · E02'], [54, 'Digimon: La película', '15:03', 'Especial · 89 min']]],
      ['12', 'Cartoon Clásico', [[40, 'Hey Arnold!', '14:00', 'T1 · E07'], [24, 'Los Simpson', '14:40', 'T5 · E22'], [56, 'Los Simpson', '15:04', 'T5 · E23–24']]],
      ['23', 'Anime 90s', [[36, 'Caballeros del Zodiaco', '14:00', 'T1 · E31'], [24, 'Digimon Adventure', '14:36', 'T1 · E12'], [60, 'Pokémon', '15:00', 'T1 · E04–05']]],
      ['31', 'Tarde de Sábado', [[62, 'Digimon: La película', '13:58', 'Especial'], [58, 'Pokémon', '15:00', 'T1 · E05–06']]],
      ['40', 'Noche Retro', [[120, 'Fuera del aire', '—', 'Sin era seleccionada']]]
    ];
    let sel = null;
    const rows = data.map(([num, name, slots], ri) => ({
      num, name,
      slots: slots.map(([min, title, time, sub], si) => {
        const key = ri + '-' + si;
        const on = key === this.state.focus;
        if (on) sel = { ch: 'CH ' + num + ' ' + name.toUpperCase(), time, title, sub };
        return {
          title, sub,
          pick: () => this.setState({ focus: key }),
          style: 'flex: ' + min + ' 0 0; min-width: 0; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: 4px; padding: 0 20px; border-radius: 14px; cursor: pointer; text-align: left; font-family: inherit; '
            + (on ? 'background: #ECE8DC; color: #0B0B09; border: 0; box-shadow: 0 0 0 4px #FFB547; transform: scale(1.02);' : 'background: #1A1A16; color: #ECE8DC; border: 2px solid #24241F;')
        };
      })
    }));
    return { rows, sel, hours: ['14:00', '14:30', '15:00', '15:30', '16:00'] };
  }
}

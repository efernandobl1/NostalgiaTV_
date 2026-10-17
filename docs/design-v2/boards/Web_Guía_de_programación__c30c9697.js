// props: {"$preview":{"width":1440,"height":1000}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { day: 0, cat: 0 };
  }
  renderVals() {
    const days = ['Hoy', 'Mañana', 'Lunes'].map((label, i) => {
      const on = i === this.state.day;
      return {
        label, pressed: on ? 'true' : 'false', pick: () => this.setState({ day: i }),
        style: 'min-height: 44px; padding: 0 18px; border-radius: 22px; cursor: pointer; font: 500 14px \'IBM Plex Sans\', sans-serif; '
          + (on ? 'border: 1px solid #FFB547; background: #FFB547; color: #1A1206;' : 'border: 1px solid #3A3A33; background: transparent; color: #ECE8DC;')
      };
    });
    const slot = (min, title, sub, kind) => ({
      title, sub,
      style: 'flex: ' + min + ' 0 0; min-width: 0; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; gap: 2px; padding: 8px 10px; border-radius: 8px; text-decoration: none; '
        + (kind === 'now' ? 'background: #FFB547; color: #1A1206;' : kind === 'special' ? 'background: #2C2A44; color: #E2DCFF;' : 'background: #24241F; color: #ECE8DC;')
    });
    const cats = ['Todas', 'Anime', 'Caricatura', 'Comedia'].map((name, i) => {
      const on = i === this.state.cat;
      return {
        name, pressed: on ? 'true' : 'false', pick: () => this.setState({ cat: i }),
        style: 'min-height: 44px; padding: 0 16px; border-radius: 22px; cursor: pointer; font: 500 14px \'IBM Plex Sans\', sans-serif; '
          + (on ? 'border: 1px solid #FFB547; background: #FFB547; color: #1A1206;' : 'border: 1px solid #3A3A33; background: transparent; color: #ECE8DC;')
      };
    });
    return {
      days, cats,
      hours: ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'],
      rows: [
        { num: '05', name: 'Canal 5 Retro', slots: [slot(15, 'Hey Arnold!', '13:48'), slot(24, 'Dragon Ball Z', 'T2 · E14', 'now'), slot(24, 'Pokémon', 'T3 · E02'), slot(89, 'Digimon: La película', 'Especial', 'special'), slot(24, 'Caballeros', 'T1 · E31'), slot(24, 'El Chavo del 8', 'T3 · E11'), slot(40, 'Dragon Ball Z', 'T2 · E15')] },
        { num: '12', name: 'Cartoon Clásico', slots: [slot(40, 'Hey Arnold!', 'T1 · E07', 'now'), slot(24, 'Los Simpson', 'T5 · E22'), slot(24, 'Los Simpson', 'T5 · E23'), slot(48, 'Hey Arnold!', 'T1 · E08–09'), slot(48, 'Los Simpson', 'T6 · E01–02'), slot(56, 'Hey Arnold!', 'T1 · E10')] },
        { num: '23', name: 'Anime 90s', slots: [slot(36, 'Caballeros del Zodiaco', 'T1 · E31', 'now'), slot(24, 'Digimon Adventure', 'T1 · E12'), slot(24, 'Pokémon', 'T1 · E04'), slot(48, 'Dragon Ball Z', 'T1 · E01–02'), slot(48, 'Digimon Adventure', 'T1 · E13–14'), slot(60, 'Caballeros', 'T1 · E32–33')] },
        { num: '31', name: 'Tarde de Sábado', slots: [slot(62, 'Digimon: La película', 'Especial', 'now'), slot(24, 'Pokémon', 'T1 · E05'), slot(24, 'Pokémon', 'T1 · E06'), slot(130, 'Maratón Hey Arnold!', 'T2 · E01–05')] },
        { num: '40', name: 'Noche Retro', slots: [slot(240, 'Fuera del aire', 'Sin era seleccionada')] }
      ]
    };
  }
}

// props: {"$preview":{"width":1440,"height":1500}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { era: 1 };
  }
  renderVals() {
    const data = [
      { name: 'Inicios', years: '1991–1995', w: 4, desc: 'Las primeras caricaturas dobladas llegan en bloques matutinos de fin de semana.', series: [['Los Caballeros del Zodiaco', 'Todas las temporadas'], ['El Chavo del 8', 'T1–T3']] },
      { name: 'Época dorada', years: '1996–2001', w: 6, onAir: true, desc: 'El anime toma la tarde después de la escuela. Cortes de 2 a 4 anuncios y los bumpers de «Ya viene» que todos recuerdan.', series: [['Dragon Ball Z', 'T2–T3'], ['Los Simpson', 'Todas'], ['Hey Arnold!', 'T1–T2'], ['Pokémon', 'T1–T3'], ['Los Caballeros del Zodiaco', 'Todas']] },
      { name: 'Era digital', years: '2002–2007', w: 6, desc: 'Cambio de imagen del canal y bumpers en 3D.', series: [['Digimon Adventure', 'T1'], ['Pokémon', 'T4–T6']] },
      { name: 'Revival', years: '2008 –', w: 3, desc: 'Repeticiones y especiales de aniversario.', series: [['Dragon Ball Z', 'Especiales']] }
    ];
    const eras = data.map((e, i) => {
      const on = i === this.state.era;
      return {
        ...e, onAir: !!e.onAir, pressed: on ? 'true' : 'false', pick: () => this.setState({ era: i }),
        style: 'flex: ' + e.w + ' 1 0; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 14px; border-radius: 10px; cursor: pointer; font: inherit; text-align: left; '
          + (on ? 'border: 1px solid #FFB547; background: #FFB547; color: #1A1206;' : 'border: 1px solid #3A3A33; background: #171714; color: #ECE8DC;')
      };
    });
    const era = data[this.state.era];
    return {
      eras, era,
      series: era.series.map(([name, seasons]) => ({ name, seasons })),
      next: [
        { time: '14:15', title: 'Dragon Ball Z', sub: 'T2 · E14 · ahora', color: '#FF8A80' },
        { time: '14:39', title: 'Pokémon', sub: 'T3 · E02', color: '#ECE8DC' },
        { time: '15:03', title: 'Digimon: La película', sub: 'Especial', color: '#ECE8DC' },
        { time: '16:32', title: 'Los Caballeros del Zodiaco', sub: 'T1 · E31', color: '#ECE8DC' }
      ],
      comments: [
        { user: 'lucia', time: 'hace 48 min', body: 'Los bumpers de Ya viene están idénticos a los de la tele de antes.' },
        { user: 'maria.g', time: 'ayer', body: '¿Van a agregar la era de los 2000?' }
      ]
    };
  }
}

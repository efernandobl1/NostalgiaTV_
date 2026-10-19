// props: {"$preview":{"width":1440,"height":1300}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { channel: 0, era: 1, dlg: null, mode: 'edit' };
  }
  renderVals() {
    const chans = [
      ['05', 'Canal 5 Retro', 'Época dorada 1996–2001'],
      ['12', 'Cartoon Clásico', 'Fines de los 90'],
      ['23', 'Anime 90s', 'Tardes de anime'],
      ['31', 'Tarde de Sábado', 'Sábados 2003'],
      ['40', 'Noche Retro', 'Sin era seleccionada']
    ];
    const channels = chans.map(([num, name, era], i) => {
      const on = i === this.state.channel;
      return {
        num, name, era,
        pressed: on ? 'true' : 'false',
        pick: () => this.setState({ channel: i }),
        style: 'display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px; border-radius: 10px; cursor: pointer; font: inherit; '
          + (on ? 'border: 1px solid #FFB547; background: #24231C;' : 'border: 1px solid #2C2C27; background: #171714;')
      };
    });
    const eraData = [
      { name: 'Inicios', years: '1991–1995', w: 4, slug: 'inicios', desc: 'Primeras caricaturas dobladas y bloques matutinos.' },
      { name: 'Época dorada', years: '1996–2001', w: 6, slug: 'epoca-dorada', desc: 'Auge del anime en la tarde y cortes de 2 a 4 anuncios.', onAir: true },
      { name: 'Era digital', years: '2002–2007', w: 6, slug: 'era-digital', desc: 'Cambio de imagen del canal y bumpers en 3D.' },
      { name: 'Revival', years: '2008 –', w: 3, slug: 'revival', desc: 'Repeticiones y especiales de aniversario.' }
    ];
    const eras = eraData.map((e, i) => {
      const on = i === this.state.era;
      return {
        ...e,
        onAir: !!e.onAir,
        pressed: on ? 'true' : 'false',
        pick: () => this.setState({ era: i }),
        style: 'flex: ' + e.w + ' 1 0; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 12px; border-radius: 6px; cursor: pointer; font: inherit; text-align: left; '
          + (on ? 'border: 1px solid #FFB547; background: #FFB547; color: #1A1206;' : 'border: 1px solid #3A3A33; background: #1F1F1B; color: #ECE8DC;')
      };
    });
    const all = [{ label: 'Todas', ink: '#ECE8DC', bg: '#3A3A33' }];
    const pick = (...n) => n.map((x) => ({ label: 'T' + x, ink: '#1A1206', bg: '#FFB547' }));
    const show = (dlg, mode) => () => this.setState({ dlg, mode: mode || 'edit' });
    const d = this.state.dlg;
    return {
      channels, eras,
      era: eraData[this.state.era],
      mode: this.state.mode,
      dlg: { channel: d === 'channel', era: d === 'era', eraSeries: d === 'eraSeries', eraInterlude: d === 'eraInterlude', broadcast: d === 'broadcast' },
      open: {
        newChannel: show('channel', 'create'), editChannel: show('channel'),
        newEra: show('era', 'create'), editEra: show('era'),
        eraSeries: show('eraSeries'), eraInterlude: show('eraInterlude'), broadcast: show('broadcast')
      },
      close: () => this.setState({ dlg: null }),
      eraSeries: [
        { name: 'Dragon Ball Z', seasons: pick(2, 3), interludes: '2 bumpers' },
        { name: 'Los Simpson', seasons: all, interludes: '—' },
        { name: 'Hey Arnold!', seasons: pick(1, 2), interludes: '1 bumper' },
        { name: 'Pokémon', seasons: pick(1, 2, 3), interludes: '3 bumpers' },
        { name: 'Los Caballeros del Zodiaco', seasons: all, interludes: '—' }
      ],
      eraInterludes: [
        { kind: 'YA VIENE', color: '#B8A6FF', title: 'Ya viene · Canal 5 (1997)', weight: 3, gap: '15 min' },
        { kind: 'CONTINUAMOS', color: '#B8A6FF', title: 'Continuamos con · Canal 5', weight: 3, gap: '15 min' },
        { kind: 'GENÉRICO', color: '#B8A6FF', title: 'Ident estrella dorada', weight: 1, gap: '30 min' },
        { kind: 'ANUNCIO', color: '#6FD0EA', title: 'Anuncio cereal (1998)', weight: 2, gap: '45 min' },
        { kind: 'ANUNCIO', color: '#6FD0EA', title: 'Anuncio juguete (1997)', weight: 2, gap: '45 min' }
      ]
    };
  }
}

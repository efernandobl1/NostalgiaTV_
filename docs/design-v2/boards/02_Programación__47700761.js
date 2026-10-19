// props: {"$preview":{"width":1440,"height":1180}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { channel: 0, program: 2, dlg: null };
  }
  renderVals() {
    const C = { ep: '#FFB547', ad: '#6FD0EA', bump: '#B8A6FF' };
    const seg = (k, w) => ({ w, color: C[k] });
    const std = [seg('ep', 7), seg('bump', 0.3), seg('ad', 0.5), seg('ad', 0.5), seg('bump', 0.3), seg('ep', 7), seg('bump', 0.3), seg('ad', 0.5), seg('ad', 0.5), seg('ad', 0.5), seg('bump', 0.3), seg('ep', 7)];
    const raw = [
      { start: '13:00', end: '13:24', title: 'Los Simpson', code: 'T05 · E21', type: 'Episodio', segs: std },
      { start: '13:24', end: '13:48', title: 'Hey Arnold!', code: 'T02 · E03', type: 'Episodio', segs: std },
      { start: '14:15', end: '14:39', title: 'Dragon Ball Z', code: 'T02 · E14', type: 'Episodio', live: true, segs: std },
      { start: '14:39', end: '15:03', title: 'Pokémon', code: 'T03 · E02', type: 'Episodio', segs: std },
      { start: '15:03', end: '16:32', title: 'Digimon: La película', code: 'ESPECIAL', type: 'Película', segs: [seg('ep', 20), seg('bump', 0.3), seg('ad', 0.6), seg('ad', 0.6), seg('bump', 0.3), seg('ep', 20), seg('bump', 0.3), seg('ad', 0.6), seg('bump', 0.3), seg('ep', 20)] },
      { start: '16:32', end: '16:56', title: 'Los Caballeros del Zodiaco', code: 'T01 · E31', type: 'Episodio', segs: std },
      { start: '16:56', end: '17:20', title: 'El Chavo del 8', code: 'T03 · E11', type: 'Episodio', segs: std },
      { start: '17:20', end: '17:44', title: 'Dragon Ball Z', code: 'T02 · E15', type: 'Episodio', segs: std }
    ];
    const programs = raw.map((p, i) => {
      const on = i === this.state.program;
      return {
        ...p,
        live: !!p.live,
        pressed: on ? 'true' : 'false',
        pick: () => this.setState({ program: i }),
        rowStyle: 'display: flex; gap: 16px; align-items: flex-start; width: 100%; padding: 14px 18px; border: 0; border-bottom: 1px solid #24241F; cursor: pointer; font: inherit; color: inherit; text-align: left; '
          + (on ? 'background: #24231C; box-shadow: inset 3px 0 0 #FFB547;' : 'background: transparent;')
      };
    });
    const names = [['CH 05', 'Canal 5 Retro'], ['CH 12', 'Cartoon Clásico'], ['CH 23', 'Anime 90s'], ['CH 31', 'Tarde de Sábado'], ['CH 40', 'Noche Retro']];
    const channels = names.map(([code, name], i) => {
      const on = i === this.state.channel;
      return {
        code, name,
        pressed: on ? 'true' : 'false',
        pick: () => this.setState({ channel: i }),
        style: 'display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 14px; border-radius: 20px; cursor: pointer; font: 500 13px \'IBM Plex Sans\', sans-serif; '
          + (on ? 'border: 1px solid #FFB547; background: #FFB547; color: #1A1206;' : 'border: 1px solid #3A3A33; background: transparent; color: #ECE8DC;')
      };
    });
    const sel = programs[this.state.program];
    const segRows = [
      { at: sel.start + ':00', kind: 'EPISODIO', color: C.ep, content: 'Bloque 1', range: '00:00 → 07:12' },
      { at: '+07:12', kind: 'BUMPER', color: C.bump, content: 'Ya viene · Canal 5', range: '0:05' },
      { at: '+07:17', kind: 'ANUNCIO', color: C.ad, content: 'Anuncio cereal (1998)', range: '0:30' },
      { at: '+07:47', kind: 'ANUNCIO', color: C.ad, content: 'Anuncio juguete (1997)', range: '0:30' },
      { at: '+08:17', kind: 'BUMPER', color: C.bump, content: 'Continuamos con', range: '0:05' },
      { at: '+08:22', kind: 'EPISODIO', color: C.ep, content: 'Bloque 2', range: '07:12 → 14:30' },
      { at: '+15:40', kind: 'CORTE', color: C.ad, content: '3 anuncios · 1:30', range: '—' }
    ];
    return {
      channels, programs, sel, segRows,
      dlgRegen: this.state.dlg === 'regen',
      openRegen: () => this.setState({ dlg: 'regen' }),
      close: () => this.setState({ dlg: null }),
      rules: [
        { label: 'Ventana sin repetir', value: '24 h' },
        { label: 'Especiales por día', value: '2 · máx 1 por serie' },
        { label: 'Películas por día', value: '1 · máx 1 por serie' },
        { label: 'Anuncios por corte (era)', value: '2 – 4' },
        { label: 'Duración máx. de corte', value: '180 s' }
      ]
    };
  }
}

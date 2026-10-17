// props: {"$preview":{"width":1440,"height":1200}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { tab: 0 };
  }
  renderVals() {
    const S = {
      Pending: ['PENDIENTE', '#FFB547'], Approved: ['APROBADO', '#8BE08F'],
      Rejected: ['RECHAZADO', '#FF8A80'], Hidden: ['OCULTO', '#A29E91']
    };
    const keys = ['Pending', 'Approved', 'Rejected', 'Hidden'];
    const tabs = [['Pendientes', 12], ['Aprobados', 340], ['Rechazados', 18], ['Ocultos', 5]].map(([label, count], i) => {
      const on = i === this.state.tab;
      return {
        label, count, pressed: on ? 'true' : 'false', pick: () => this.setState({ tab: i }),
        style: 'min-height: 40px; padding: 0 14px; border-radius: 20px; cursor: pointer; font: 500 13px \'IBM Plex Sans\', sans-serif; '
          + (on ? 'border: 1px solid #FFB547; background: #FFB547; color: #1A1206;' : 'border: 1px solid #3A3A33; background: transparent; color: #ECE8DC;')
      };
    });
    const status = keys[this.state.tab];
    const base = [
      { user: 'maria.g', target: 'SERIE · Dragon Ball Z', isSeries: true, time: 'hace 2 h', body: 'Me encanta que pusieran la saga de Namek completa, así la veía de niña después de la escuela.' },
      { user: 'jpablo', target: 'SERIE · Dragon Ball Z', isSeries: true, replyTo: 'maria.g', time: 'hace 1 h', body: 'Igual yo, falta el episodio 16 de la temporada 2 pero lo demás está perfecto.' },
      { user: 'lucia', target: 'CANAL · Canal 5 Retro', isSeries: false, time: 'hace 48 min', body: 'Los bumpers de Ya viene están idénticos a los de la tele de antes, qué nostalgia.' },
      { user: 'fernando', target: 'CANAL · Anime 90s', isSeries: false, time: 'hace 30 min', body: 'Podrían agregar más cortes comerciales en la tarde para que se sienta más real.' },
      { user: 'invitado_77', target: 'SERIE · Pokémon', isSeries: true, time: 'hace 12 min', body: '¿Van a subir la temporada 4 con el doblaje original?' }
    ];
    const items = base.map((c) => ({
      ...c,
      isReply: !!c.replyTo,
      replyTo: c.replyTo || '',
      targetColor: c.isSeries ? '#FFB547' : '#6FD0EA',
      status: S[status][0],
      statusColor: S[status][1],
      cardStyle: 'position: relative; display: flex; gap: 14px; padding: 18px 20px; background: #171714; border: 1px solid #2C2C27; border-radius: 10px;'
        + (c.replyTo ? ' margin-left: 40px;' : '')
    }));
    return { tabs, items };
  }
}

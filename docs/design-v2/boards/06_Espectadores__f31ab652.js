// props: {"$preview":{"width":1440,"height":1100}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { profile: 0, dlg: null, device: '' };
  }
  renderVals() {
    const raw = [
      ['FE', 'fernando', '3b1f…92c0', 3],
      ['MA', 'maria.g', '8d02…1a4e', 2],
      ['AN', 'Anónimo', 'c47a…e011', 1],
      ['JP', 'jpablo', '1e9b…77d3', 1],
      ['AN', 'Anónimo', '5f60…0b2a', 1],
      ['LU', 'lucia', 'a2c8…4f19', 2]
    ];
    const profiles = raw.map(([initials, name, id, devices], i) => {
      const on = i === this.state.profile;
      return {
        initials, name, id, devices,
        pressed: on ? 'true' : 'false',
        pick: () => this.setState({ profile: i }),
        style: 'display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px; border-radius: 10px; cursor: pointer; font: inherit; '
          + (on ? 'border: 1px solid #FFB547; background: #24231C;' : 'border: 1px solid #2C2C27; background: #171714;')
      };
    });
    return {
      profiles,
      sel: profiles[this.state.profile],
      dlgRevoke: this.state.dlg === 'revoke',
      revokeHeading: this.state.device ? '¿Revocar «' + this.state.device + '»?' : '¿Revocar todos los dispositivos de ' + profiles[this.state.profile].name + '?',
      revokeAll: () => this.setState({ dlg: 'revoke', device: '' }),
      close: () => this.setState({ dlg: null }),
      kpis: [
        { label: 'PERFILES', value: '148', note: '112 con cuenta · 36 anónimos' },
        { label: 'DISPOSITIVOS ACTIVOS', value: '203', note: 'Vistos en las últimas 24 h: 61' },
        { label: 'CÓDIGOS DE VINCULACIÓN', value: '4', note: 'Pendientes de confirmar' },
        { label: 'EPISODIOS COMPLETADOS', value: '2 917', note: 'Últimos 30 días' }
      ],
      devices: [
        { name: 'Smart TV sala', seen: 'hace 3 min', expires: '16 nov', color: '#8BE08F' },
        { name: 'Laptop', seen: 'hace 2 días', expires: '02 nov', color: '#A29E91' },
        { name: 'Teléfono', seen: 'hace 9 días', expires: '25 oct', color: '#A29E91' }
      ].map((d) => ({ ...d, revoke: () => this.setState({ dlg: 'revoke', device: d.name }) })),
      progress: [
        { series: 'Dragon Ball Z', code: 'T02 · E14', state: 'EN CURSO 64%', color: '#FFB547', ranges: [{ from: 0, w: 48 }, { from: 52, w: 12 }] },
        { series: 'Hey Arnold!', code: 'T01 · E07', state: 'COMPLETADO', color: '#8BE08F', ranges: [{ from: 0, w: 100 }] },
        { series: 'Pokémon', code: 'T03 · E01', state: 'EN CURSO 21%', color: '#FFB547', ranges: [{ from: 0, w: 21 }] },
        { series: 'Los Simpson', code: 'T05 · E20', state: 'COMPLETADO', color: '#8BE08F', ranges: [{ from: 0, w: 100 }] }
      ],
      pending: [
        { name: 'TV dormitorio', kind: 'Autorización por código', exp: '8 min' },
        { name: 'Consola sala', kind: 'Código de vinculación', exp: '3 min' }
      ]
    };
  }
}

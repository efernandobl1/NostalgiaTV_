// props: {"$preview":{"width":1440,"height":1100}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { kind: 0, dlg: null };
  }
  renderVals() {
    const kinds = [['Todos', 86], ['Bumpers', 34], ['Anuncios', 52]].map(([label, count], i) => {
      const on = i === this.state.kind;
      return {
        label, count, pressed: on ? 'true' : 'false', pick: () => this.setState({ kind: i }),
        style: 'min-height: 40px; padding: 0 14px; border-radius: 20px; cursor: pointer; font: 500 13px \'IBM Plex Sans\', sans-serif; '
          + (on ? 'border: 1px solid #FFB547; background: #FFB547; color: #1A1206;' : 'border: 1px solid #3A3A33; background: transparent; color: #ECE8DC;')
      };
    });
    const B = '#B8A6FF', A = '#6FD0EA';
    const ok = ['Aprobado', '#8BE08F'], no = ['Pendiente', '#FFB547'];
    const all = [
      ['Ya viene · Canal 5 (1997)', 'BUMPER · YA VIENE', B, 'Todo el año', '0:05', '1996–1999', ok, '—'],
      ['Continuamos con · Canal 5', 'BUMPER · CONTINUAMOS', B, 'Todo el año', '0:04', '1996–1999', ok, '—'],
      ['Ident estrella dorada', 'BUMPER · GENÉRICO', B, 'Todo el año', '0:08', '1998', ok, '—'],
      ['Ya viene · Especial Halloween', 'BUMPER · YA VIENE', B, 'Halloween', '0:06', '2001', no, '—'],
      ['Anuncio cereal (1998)', 'ANUNCIO', A, 'Todo el año', '0:30', '1998', ok, '—'],
      ['Anuncio juguete (1997)', 'ANUNCIO', A, 'Navidad', '0:30', '1997', ok, '—'],
      ['Anuncio refresco (2000)', 'ANUNCIO', A, 'Todo el año', '0:20', '2000', no, '—'],
      ['Promo programación sábado', 'ANUNCIO', A, 'Todo el año', '0:15', '2003', ok, 'CC BY 4.0']
    ];
    const rows = all
      .filter((r) => this.state.kind === 0 || (this.state.kind === 1 ? r[1].startsWith('BUMPER') : r[1] === 'ANUNCIO'))
      .map(([title, kind, color, season, dur, years, ap, license]) => ({ title, kind, color, season, dur, years, approved: ap[0], apColor: ap[1], license, edit: () => this.setState({ dlg: 'edit' }), remove: () => this.setState({ dlg: 'delete' }) }));
    return {
      kinds, rows,
      dlgEdit: this.state.dlg === 'edit',
      dlgDelete: this.state.dlg === 'delete',
      openEdit: () => this.setState({ dlg: 'edit' }),
      openDelete: () => this.setState({ dlg: 'delete' }),
      close: () => this.setState({ dlg: null })
    };
  }
}

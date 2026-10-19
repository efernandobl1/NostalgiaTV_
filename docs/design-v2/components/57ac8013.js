// props: {"onClose":{"editor":null},"$preview":{"width":600,"height":720}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { on: { 0: true, 2: true }, seasons: { '0-2': true, '0-3': true } };
  }
  renderVals() {
    const list = [
      ['Dragon Ball Z', '1989–1996', 5],
      ['Los Simpson', '1989 –', 6],
      ['Hey Arnold!', '1996–2004', 5],
      ['Pokémon', '1997 –', 4],
      ['Digimon Adventure', '1999–2000', 1],
      ['Los Caballeros del Zodiaco', '1986–1989', 5]
    ];
    const rows = list.map(([name, years, n], i) => {
      const on = !!this.state.on[i];
      const seasons = Array.from({ length: n }, (_, k) => {
        const key = i + '-' + (k + 1);
        const sel = !!this.state.seasons[key];
        return {
          label: 'T' + (k + 1),
          pressed: sel ? 'true' : 'false',
          toggle: () => this.setState({ seasons: { ...this.state.seasons, [key]: !sel } }),
          style: 'min-height: 32px; padding: 0 10px; border-radius: 4px; cursor: pointer; font: 500 12px \'IBM Plex Mono\', monospace; '
            + (sel ? 'border: 1px solid #FFB547; background: #FFB547; color: #1A1206;' : 'border: 1px solid #3A3A33; background: transparent; color: #ECE8DC;')
        };
      });
      return { name, years, on, seasons, toggle: () => this.setState({ on: { ...this.state.on, [i]: !on } }) };
    });
    return {
      rows,
      count: rows.filter((r) => r.on).length,
      close: () => this.props.onClose && this.props.onClose()
    };
  }
}

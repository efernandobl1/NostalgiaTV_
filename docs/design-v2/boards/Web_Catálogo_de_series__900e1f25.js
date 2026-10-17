// props: {"$preview":{"width":1440,"height":1300}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { cats: {}, decade: null, air: false, prog: false, q: '' };
  }
  renderVals() {
    const data = [
      ['Dragon Ball Z', '1989–1996', 1980, '8.8', ['Anime', 'Acción'], '05', 64],
      ['Los Simpson', '1989 –', 1980, '8.7', ['Caricatura', 'Comedia'], '12', 0],
      ['Hey Arnold!', '1996–2004', 1990, '8.0', ['Caricatura', 'Comedia'], '12', 0],
      ['Pokémon', '1997 –', 1990, '7.6', ['Anime', 'Aventura'], '05', 21],
      ['Digimon Adventure', '1999–2000', 1990, '8.0', ['Anime', 'Aventura'], '23', 0],
      ['Los Caballeros del Zodiaco', '1986–1989', 1980, '8.4', ['Anime', 'Acción'], '23', 0],
      ['El Chavo del 8', '1973–1980', 1970, '8.6', ['Comedia', 'Live action'], '05', 0],
      ['Las Tortugas Ninja', '1987–1996', 1980, '7.9', ['Caricatura', 'Acción'], '', 0]
    ];
    const catList = ['Anime', 'Caricatura', 'Comedia', 'Acción', 'Aventura', 'Live action'];
    const st = this.state;
    const picked = catList.filter((c) => st.cats[c]);
    const q = st.q.trim().toLowerCase();
    const series = data
      .filter(([name, , dec, , tags, ch, pct]) =>
        (!q || name.toLowerCase().indexOf(q) >= 0) &&
        (picked.length === 0 || picked.some((p) => tags.indexOf(p) >= 0)) &&
        (st.decade === null || dec === st.decade) &&
        (!st.air || ch) && (!st.prog || pct > 0))
      .map(([name, years, , rating, , ch, pct]) => ({ name, years, rating, ch, pct, onAir: !!ch }));
    const cats = catList.map((name) => ({
      name, on: !!st.cats[name],
      n: data.filter((d) => d[4].indexOf(name) >= 0).length,
      toggle: () => this.setState({ cats: { ...st.cats, [name]: !st.cats[name] } })
    }));
    const decades = [[1970, '70s'], [1980, '80s'], [1990, '90s'], [2000, '2000s']].map(([v, label]) => {
      const on = st.decade === v;
      return {
        label, pressed: on ? 'true' : 'false',
        pick: () => this.setState({ decade: on ? null : v }),
        style: 'min-height: 40px; padding: 0 14px; border-radius: 20px; cursor: pointer; font: 500 13px \'IBM Plex Mono\', monospace; '
          + (on ? 'border: 1px solid #FFB547; background: #FFB547; color: #1A1206;' : 'border: 1px solid #3A3A33; background: transparent; color: #ECE8DC;')
      };
    });
    const activeChips = picked.map((c) => ({ label: c, remove: () => this.setState({ cats: { ...st.cats, [c]: false } }) }));
    if (st.decade !== null) activeChips.push({ label: 'Década ' + String(st.decade).slice(2) + 's', remove: () => this.setState({ decade: null }) });
    if (st.air) activeChips.push({ label: 'Al aire hoy', remove: () => this.setState({ air: false }) });
    if (st.prog) activeChips.push({ label: 'Que estoy viendo', remove: () => this.setState({ prog: false }) });
    return {
      cats, decades, series, activeChips,
      count: data.length,
      none: series.length === 0,
      resultLabel: series.length + ' resultados',
      q: st.q,
      setQ: (e) => this.setState({ q: e.target.value }),
      onAir: st.air, inProgress: st.prog,
      toggleAir: () => this.setState({ air: !st.air }),
      toggleProg: () => this.setState({ prog: !st.prog }),
      clear: () => this.setState({ cats: {}, decade: null, air: false, prog: false, q: '' })
    };
  }
}

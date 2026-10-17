// props: {"season":{"editor":"enum","options":["none","halloween","christmas"],"default":"halloween"},"$preview":{"width":1440,"height":1500}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { cat: 0, live: false, q: '', view: 'grid' };
  }
  renderVals() {
    const season = this.props.season ?? 'halloween';
    const S = {
      none: { accent: '#FFB547' },
      halloween: { accent: '#FF9A3D', bg: '#2A1A0C', ink: '#FFC48A', tag: 'ESPECIAL DE HALLOWEEN', text: 'Del 17 al 31 de octubre: episodios de terror y bumpers de época en todos los canales.' },
      christmas: { accent: '#8BE08F', bg: '#132216', ink: '#B9F0BC', tag: 'TEMPORADA NAVIDEÑA', text: 'Especiales navideños y anuncios de diciembre hasta el 6 de enero.' }
    }[season];
    const catNames = ['Todos', 'Anime', 'Caricatura', 'Comedia', 'Live action'];
    const chip = (on) => 'min-height: 44px; padding: 0 16px; border-radius: 22px; cursor: pointer; font: 500 14px \'IBM Plex Sans\', sans-serif; '
      + (on ? 'border: 1px solid #FFB547; background: #FFB547; color: #1A1206;' : 'border: 1px solid #3A3A33; background: transparent; color: #ECE8DC;');
    const cats = catNames.map((name, i) => ({ name, pressed: i === this.state.cat ? 'true' : 'false', style: chip(i === this.state.cat), pick: () => this.setState({ cat: i }) }));
    const live = { badge: '● EN VIVO', badgeInk: '#1A0906', badgeBg: '#FF6B5E' };
    const all = [
      { ...live, num: '05', name: 'Canal 5 Retro', era: 'Época dorada 1996–2001', now: 'Dragon Ball Z', next: 'Pokémon 14:39', pct: 34, tags: ['Anime', 'Caricatura'], on: true },
      { ...live, num: '12', name: 'Cartoon Clásico', era: 'Fines de los 90', now: 'Hey Arnold!', next: 'Los Simpson 14:40', pct: 71, tags: ['Caricatura', 'Comedia'], on: true },
      { ...live, num: '23', name: 'Anime 90s', era: 'Tardes de anime', now: 'Los Caballeros del Zodiaco', next: 'Digimon 14:36', pct: 12, tags: ['Anime'], on: true },
      { ...live, num: '31', name: 'Tarde de Sábado', era: 'Sábados 2003', now: 'Digimon: La película', next: 'Pokémon 15:00', pct: 58, tags: ['Anime', 'Caricatura'], on: true },
      { num: '40', name: 'Noche Retro', era: 'Sin era seleccionada', now: 'Fuera del aire', next: '—', pct: 0, tags: ['Live action', 'Comedia'], on: false, badge: 'SIN SEÑAL', badgeInk: '#ECE8DC', badgeBg: '#3A3A33' }
    ];
    const q = this.state.q.trim().toLowerCase();
    const cat = catNames[this.state.cat];
    const channels = all.filter((c) =>
      (this.state.cat === 0 || c.tags.indexOf(cat) >= 0) &&
      (!this.state.live || c.on) &&
      (!q || (c.name + ' ' + c.now).toLowerCase().indexOf(q) >= 0));
    const isGrid = this.state.view === 'grid';
    const seg = (on) => 'width: 44px; height: 42px; display: flex; align-items: center; justify-content: center; border: 0; cursor: pointer; '
      + (on ? 'background: #FFB547; color: #1A1206;' : 'background: transparent; color: #ECE8DC;');
    return {
      accent: S.accent,
      hasSeason: season !== 'none',
      seasonBg: S.bg || '#171714', seasonInk: S.ink || '#ECE8DC', seasonTag: S.tag || '', seasonText: S.text || '',
      cats, channels,
      empty: channels.length === 0,
      q: this.state.q,
      setQ: (e) => this.setState({ q: e.target.value }),
      onlyLive: this.state.live,
      toggleLive: () => this.setState({ live: !this.state.live }),
      clearFilters: () => this.setState({ cat: 0, live: false, q: '' }),
      isGrid, isList: !isGrid,
      gridBtn: seg(isGrid), listBtn: seg(!isGrid),
      gridView: () => this.setState({ view: 'grid' }),
      listView: () => this.setState({ view: 'list' }),
      continueList: [
        { series: 'Dragon Ball Z', code: 'T2 · E14 · quedan 8 min', pct: 64 },
        { series: 'Pokémon', code: 'T3 · E01 · quedan 17 min', pct: 21 },
        { series: 'Hey Arnold!', code: 'T1 · E08 · nuevo', pct: 0 },
        { series: 'Los Simpson', code: 'T5 · E21 · nuevo', pct: 0 }
      ]
    };
  }
}

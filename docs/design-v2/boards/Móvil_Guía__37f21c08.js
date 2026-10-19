// props: {"$preview":{"width":390,"height":844}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { day: 0, ch: 0 };
  }
  renderVals() {
    const chip = (on) => 'flex: none; min-height: 40px; padding: 0 14px; border-radius: 20px; white-space: nowrap; font: 500 13px \'IBM Plex Sans\', sans-serif; '
      + (on ? 'border: 1px solid #FFB547; background: #FFB547; color: #1A1206;' : 'border: 1px solid #3A3A33; background: transparent; color: #ECE8DC;');
    const days = ['Hoy', 'Mañana', 'Lun 19'].map((label, i) => ({ label, pressed: i === this.state.day ? 'true' : 'false', style: chip(i === this.state.day), pick: () => this.setState({ day: i }) }));
    const chans = [['05', 'Canal 5'], ['12', 'Cartoon'], ['23', 'Anime 90s'], ['31', 'Sábado'], ['40', 'Noche']].map(([num, name], i) => ({
      num, name, pressed: i === this.state.ch ? 'true' : 'false', style: chip(i === this.state.ch), pick: () => this.setState({ ch: i })
    }));
    const raw = [
      ['13:24', '24m', 'Hey Arnold!', 'T2 · E03', 'past'], ['13:48', '27m', 'Los Simpson', 'T5 · E20', 'past'],
      ['14:15', '24m', 'Dragon Ball Z', 'T2 · E14 · El poder oculto de Gohan', 'now'], ['14:39', '24m', 'Pokémon', 'T3 · E02'],
      ['15:03', '89m', 'Digimon: La película', 'Especial', 'special'], ['16:32', '24m', 'Los Caballeros del Zodiaco', 'T1 · E31'],
      ['16:56', '24m', 'El Chavo del 8', 'T3 · E11'], ['17:20', '24m', 'Dragon Ball Z', 'T2 · E15']
    ];
    const slots = raw.map(([time, dur, title, sub, st]) => ({
      time, dur, title, sub,
      now: st === 'now',
      href: st === 'now' ? 'MobPlayer.dc.html' : 'MobSeries.dc.html',
      tag: st === 'now' ? 'AHORA' : st === 'special' ? 'ESPECIAL' : '',
      tagColor: st === 'now' ? '#FF8A80' : '#B8A6FF',
      timeColor: st === 'now' ? '#FF8A80' : st === 'past' ? '#8C887D' : '#ECE8DC',
      style: 'display: flex; gap: 12px; align-items: flex-start; padding: 14px 8px; border-bottom: 1px solid #24241F; color: #ECE8DC; text-decoration: none; '
        + (st === 'now' ? 'background: #24231C; box-shadow: inset 3px 0 0 #FFB547;' : st === 'past' ? 'opacity: 0.55;' : '')
    }));
    const nav = [['Canales', 'MobHome.dc.html'], ['Guía', 'MobGuide.dc.html'], ['Series', 'MobCatalog.dc.html'], ['Vincular', 'MobPair.dc.html']].map(([label, href], i) => ({
      label, href,
      current: i === 1 ? 'page' : 'false',
      bar: i === 1 ? '#FFB547' : 'transparent',
      style: 'flex: 1; min-height: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: 12px; text-decoration: none; '
        + (i === 1 ? 'color: #FFB547; font-weight: 600;' : 'color: #A29E91;')
    }));
    return { days, chans, slots, nav, jumpNow: () => this.setState({ day: 0 }) };
  }
}

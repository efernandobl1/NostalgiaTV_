// props: {"$preview":{"width":844,"height":390}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { ch: 0, show: true, lock: false, muted: false };
  }
  renderVals() {
    const list = [
      { num: '05', name: 'CANAL 5 RETRO', now: 'Dragon Ball Z', code: 'T2 · E14', next: 'Pokémon' },
      { num: '12', name: 'CARTOON CLÁSICO', now: 'Hey Arnold!', code: 'T1 · E07', next: 'Los Simpson' },
      { num: '23', name: 'ANIME 90S', now: 'Caballeros del Zodiaco', code: 'T1 · E31', next: 'Digimon' },
      { num: '31', name: 'TARDE DE SÁBADO', now: 'Digimon: La película', code: 'Especial', next: 'Pokémon' }
    ];
    const i = this.state.ch;
    const show = this.state.show && !this.state.lock;
    return {
      ch: list[i],
      show,
      locked: this.state.lock,
      numSize: show ? '40px' : '28px',
      numOpacity: show ? '1' : '0.4',
      toggle: () => { if (!this.state.lock) this.setState({ show: !this.state.show }); },
      toggleLock: () => this.setState({ lock: !this.state.lock }),
      toggleMute: () => this.setState({ muted: !this.state.muted }),
      muteLabel: this.state.muted ? 'Activar sonido' : 'Silenciar',
      muteD: this.state.muted ? 'M17 9l5 6M22 9l-5 6' : 'M17 8a5 5 0 0 1 0 8',
      prev: () => this.setState({ ch: (i + list.length - 1) % list.length }),
      next: () => this.setState({ ch: (i + 1) % list.length })
    };
  }
}

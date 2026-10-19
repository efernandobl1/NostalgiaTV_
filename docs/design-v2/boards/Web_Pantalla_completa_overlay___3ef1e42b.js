// props: {"overlay":{"editor":"enum","options":["controls","zapping","guide","break","idle"],"default":"controls"},"seasonFx":{"editor":"boolean","default":true},"$preview":{"width":1920,"height":1080}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { mode: null, ch: 0, muted: false };
  }
  renderVals() {
    const mode = this.state.mode ?? this.props.overlay ?? 'controls';
    const list = [
      { num: '05', name: 'CANAL 5 RETRO', era: 'Época dorada 1996–2001', now: 'Dragon Ball Z', code: 'T2 · E14', title: 'El poder oculto de Gohan', next: 'Pokémon · T3 · E02' },
      { num: '12', name: 'CARTOON CLÁSICO', era: 'Fines de los 90', now: 'Hey Arnold!', code: 'T1 · E07', title: 'Episodio 7', next: 'Los Simpson · T5 · E22' },
      { num: '23', name: 'ANIME 90S', era: 'Tardes de anime', now: 'Los Caballeros del Zodiaco', code: 'T1 · E31', title: 'Episodio 31', next: 'Digimon Adventure · T1 · E12' },
      { num: '31', name: 'TARDE DE SÁBADO', era: 'Sábados 2003', now: 'Digimon: La película', code: 'ESPECIAL', title: 'Película', next: 'Pokémon · T1 · E05' }
    ];
    const i = this.state.ch;
    const go = (k) => () => this.setState({ ch: k, mode: 'zapping' });
    const labels = [['controls', 'Controles'], ['zapping', 'Cambio de canal'], ['guide', 'Guía'], ['break', 'Corte comercial'], ['idle', 'Sin controles']];
    const show = {};
    labels.forEach(([k]) => { show[k] = () => this.setState({ mode: k }); });
    return {
      ch: list[i],
      s: { controls: mode === 'controls', zapping: mode === 'zapping', guide: mode === 'guide', brk: mode === 'break', idle: mode === 'idle' },
      show,
      seasonFx: this.props.seasonFx ?? true,
      muteD: this.state.muted ? 'M17 9l5 6M22 9l-5 6' : 'M17 8a5 5 0 0 1 0 8',
      muteLabel: this.state.muted ? 'Activar sonido' : 'Silenciar',
      toggleMute: () => this.setState({ muted: !this.state.muted }),
      prev: go((i + list.length - 1) % list.length),
      next: go((i + 1) % list.length),
      rail: list.map((c, k) => ({
        num: c.num, name: c.name, now: c.now, next: c.next.split(' · ')[0],
        pick: go(k),
        style: 'display: flex; align-items: center; gap: 16px; width: 100%; padding: 16px 18px; border-radius: 14px; cursor: pointer; font-family: inherit; color: #ECE8DC; '
          + (k === i ? 'background: #24231C; border: 2px solid #FFB547;' : 'background: transparent; border: 2px solid transparent;')
      })),
      states: labels.map(([k, label]) => ({
        label, pressed: mode === k ? 'true' : 'false', pick: show[k],
        style: 'min-height: 36px; padding: 0 14px; border: 0; border-radius: 18px; cursor: pointer; font: 500 13px \'IBM Plex Sans\', sans-serif; '
          + (mode === k ? 'background: #ECE8DC; color: #0B0B09;' : 'background: transparent; color: #A29E91;')
      }))
    };
  }
}

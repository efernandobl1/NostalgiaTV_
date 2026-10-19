// props: {"showOsd":{"editor":"boolean","default":true},"$preview":{"width":1920,"height":1080}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { ch: 0 };
  }
  renderVals() {
    const list = [
      { num: '05', name: 'CANAL 5 RETRO', era: 'ÉPOCA DORADA', now: 'Dragon Ball Z', detail: 'T2 · E14 · El poder oculto de Gohan', pct: 34, nextUp: 'Pokémon · T3 · E02' },
      { num: '12', name: 'CARTOON CLÁSICO', era: 'FINES DE LOS 90', now: 'Hey Arnold!', detail: 'T1 · E07', pct: 71, nextUp: 'Los Simpson · T5 · E22' },
      { num: '23', name: 'ANIME 90S', era: 'TARDES DE ANIME', now: 'Los Caballeros del Zodiaco', detail: 'T1 · E31', pct: 12, nextUp: 'Digimon Adventure · T1 · E12' },
      { num: '31', name: 'TARDE DE SÁBADO', era: 'SÁBADOS 2003', now: 'Digimon: La película', detail: 'Especial', pct: 58, nextUp: 'Pokémon · T1 · E05' }
    ];
    const i = this.state.ch;
    return {
      ch: list[i],
      osd: this.props.showOsd ?? true,
      prev: () => this.setState({ ch: (i + list.length - 1) % list.length }),
      next: () => this.setState({ ch: (i + 1) % list.length })
    };
  }
}

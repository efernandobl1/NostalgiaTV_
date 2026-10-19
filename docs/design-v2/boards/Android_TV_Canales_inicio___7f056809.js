// props: {"$preview":{"width":1920,"height":1080}}
class Component extends DCLogic {
  renderVals() {
    const list = [
      ['05', 'Canal 5 Retro', 'Dragon Ball Z', 34],
      ['12', 'Cartoon Clásico', 'Hey Arnold!', 71],
      ['23', 'Anime 90s', 'Caballeros del Zodiaco', 12],
      ['31', 'Tarde de Sábado', 'Digimon: La película', 58],
      ['40', 'Noche Retro', 'Fuera del aire', 0]
    ];
    return {
      channels: list.map(([num, name, now, pct]) => ({
        num, name, now, pct,
        style: 'width: 320px; flex: none; box-sizing: border-box; display: flex; flex-direction: column; gap: 14px; padding: 24px; border-radius: 18px; background: #1A1A16; border: 2px solid #2C2C27;'
      }))
    };
  }
}

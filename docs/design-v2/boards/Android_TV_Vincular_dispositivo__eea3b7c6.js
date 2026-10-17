// props: {"$preview":{"width":1920,"height":1080}}
class Component extends DCLogic {
  renderVals() {
    const bits = '111101111100100001101111101001010100111000111010101001101111101100100001111101111';
    return { qr: bits.split('').map((b) => (b === '1' ? '#0B0B09' : 'transparent')) };
  }
}

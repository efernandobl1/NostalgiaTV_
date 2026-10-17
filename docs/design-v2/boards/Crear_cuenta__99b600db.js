// props: {"$preview":{"width":1440,"height":900}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { pwd: 'Retro96' };
  }
  renderVals() {
    const p = this.state.pwd;
    const score = (p.length >= 8 ? 1 : 0) + (/\d/.test(p) ? 1 : 0) + (/[^A-Za-z0-9]/.test(p) ? 1 : 0) + (/[A-Z]/.test(p) && /[a-z]/.test(p) ? 1 : 0);
    const color = ['#FF6B5E', '#FF6B5E', '#FFB547', '#FFB547', '#8BE08F'][score];
    return {
      pwd: p,
      setPwd: (e) => this.setState({ pwd: e.target.value }),
      bars: [0, 1, 2, 3].map((i) => (i < score ? color : '#2C2C27')),
      strength: ['Muy débil', 'Débil', 'Regular', 'Buena', 'Fuerte'][score]
    };
  }
}

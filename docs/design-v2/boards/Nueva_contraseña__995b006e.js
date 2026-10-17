// props: {"$preview":{"width":1440,"height":900}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { pwd: 'Nostalgia96' };
  }
  renderVals() {
    const p = this.state.pwd;
    const rules = [
      ['Al menos 8 caracteres', p.length >= 8],
      ['Una mayúscula y una minúscula', /[A-Z]/.test(p) && /[a-z]/.test(p)],
      ['Al menos un número', /\d/.test(p)],
      ['Al menos un símbolo', /[^A-Za-z0-9]/.test(p)]
    ].map(([label, ok]) => ({ label, mark: ok ? '✓' : '·', color: ok ? '#8BE08F' : '#A29E91' }));
    return { pwd: p, setPwd: (e) => this.setState({ pwd: e.target.value }), rules };
  }
}

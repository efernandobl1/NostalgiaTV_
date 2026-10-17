// props: {"$preview":{"width":390,"height":844}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { code: 'K7Q2-M9XD', done: false };
  }
  renderVals() {
    const nav = [['Canales', 'MobHome.dc.html'], ['Guía', 'MobGuide.dc.html'], ['Series', 'MobCatalog.dc.html'], ['Vincular', 'MobPair.dc.html']].map(([label, href], i) => ({
      label, href,
      current: i === 3 ? 'page' : 'false',
      bar: i === 3 ? '#FFB547' : 'transparent',
      style: 'flex: 1; min-height: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: 12px; text-decoration: none; '
        + (i === 3 ? 'color: #FFB547; font-weight: 600;' : 'color: #A29E91;')
    }));
    return {
      nav,
      code: this.state.code,
      setCode: (e) => this.setState({ code: e.target.value.toUpperCase() }),
      form: !this.state.done,
      done: this.state.done,
      link: () => this.setState({ done: true }),
      reset: () => this.setState({ done: false, code: '' }),
      devices: [
        { name: 'Smart TV sala', meta: 'Android TV · hace 3 min' },
        { name: 'Laptop', meta: 'Navegador · hace 2 días' },
        { name: 'Este teléfono', meta: 'Android · ahora' }
      ]
    };
  }
}

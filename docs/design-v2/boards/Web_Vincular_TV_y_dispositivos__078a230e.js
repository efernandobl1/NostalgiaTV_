// props: {"$preview":{"width":1440,"height":1000}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { code: 'K7Q2-M9XD', done: false };
  }
  renderVals() {
    const tv = { x: 2, y: 5, w: 20, h: 13 }, laptop = { x: 4, y: 5, w: 16, h: 11 }, phone = { x: 7, y: 3, w: 10, h: 18 };
    return {
      code: this.state.code,
      setCode: (e) => this.setState({ code: e.target.value.toUpperCase() }),
      form: !this.state.done,
      done: this.state.done,
      link: () => this.setState({ done: true }),
      reset: () => this.setState({ done: false, code: '' }),
      devices: [
        { ...tv, name: 'Smart TV sala', meta: 'Android TV · visto hace 3 min' },
        { ...laptop, name: 'Laptop', meta: 'Navegador · visto hace 2 días' },
        { ...phone, name: 'Teléfono', meta: 'Android · visto hace 9 días' }
      ]
    };
  }
}

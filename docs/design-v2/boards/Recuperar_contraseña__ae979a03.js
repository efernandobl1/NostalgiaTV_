// props: {"$preview":{"width":1440,"height":900}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { sent: false };
  }
  renderVals() {
    return {
      form: !this.state.sent,
      sent: this.state.sent,
      send: () => this.setState({ sent: true }),
      reset: () => this.setState({ sent: false })
    };
  }
}

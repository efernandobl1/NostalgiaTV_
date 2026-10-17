// props: {"onClose":{"editor":null},"$preview":{"width":600,"height":600}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { scope: 0 };
  }
  renderVals() {
    const scopes = [
      ['Toda la era', 'Puede aparecer en cualquier corte'],
      ['Solo una serie', 'Aparece únicamente en cortes de esa serie']
    ].map(([label, hint], i) => ({ label, hint, on: this.state.scope === i, pick: () => this.setState({ scope: i }) }));
    return {
      scopes,
      bySeries: this.state.scope === 1,
      close: () => this.props.onClose && this.props.onClose()
    };
  }
}

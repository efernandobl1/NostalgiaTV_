// props: {"onClose":{"editor":null},"$preview":{"width":600,"height":800}}
class Component extends DCLogic {
  renderVals() {
    return { close: () => this.props.onClose && this.props.onClose() };
  }
}

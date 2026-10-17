// props: {"variant":{"editor":"enum","options":["normal","error","locked"],"default":"normal"},"$preview":{"width":1440,"height":900}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { show: false };
  }
  renderVals() {
    const v = this.props.variant ?? 'normal';
    return {
      isError: v === 'error',
      isLocked: v === 'locked',
      pwdBorder: v === 'error' ? '#FF8A80' : '#3A3A33',
      pwdType: this.state.show ? 'text' : 'password',
      pwdToggleLabel: this.state.show ? 'Ocultar contraseña' : 'Mostrar contraseña',
      togglePwd: () => this.setState({ show: !this.state.show })
    };
  }
}

// props: {"mode":{"editor":"enum","options":["edit","create"],"default":"edit"},"onClose":{"editor":null},"$preview":{"width":600,"height":400}}
class Component extends DCLogic {
  renderVals() {
    const create = (this.props.mode ?? 'edit') === 'create';
    return {
      heading: create ? 'Nuevo rol' : 'Editar rol',
      roleName: create ? '' : 'Editor',
      close: () => this.props.onClose && this.props.onClose()
    };
  }
}

// props: {"mode":{"editor":"enum","options":["edit","create"],"default":"edit"},"onClose":{"editor":null},"$preview":{"width":600,"height":760}}
class Component extends DCLogic {
  renderVals() {
    const create = (this.props.mode ?? 'edit') === 'create';
    return {
      heading: create ? 'Nueva era' : 'Editar era',
      saveLabel: create ? 'Crear era' : 'Guardar cambios',
      name: create ? '' : 'Época dorada',
      close: () => this.props.onClose && this.props.onClose()
    };
  }
}

// props: {"mode":{"editor":"enum","options":["edit","create"],"default":"edit"},"onClose":{"editor":null},"$preview":{"width":600,"height":660}}
class Component extends DCLogic {
  renderVals() {
    const create = (this.props.mode ?? 'edit') === 'create';
    return {
      heading: create ? 'Nuevo canal' : 'Editar canal',
      saveLabel: create ? 'Crear canal' : 'Guardar cambios',
      name: create ? '' : 'Canal 5 Retro',
      close: () => this.props.onClose && this.props.onClose()
    };
  }
}

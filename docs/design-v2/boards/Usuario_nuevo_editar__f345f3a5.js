// props: {"mode":{"editor":"enum","options":["edit","create"],"default":"edit"},"onClose":{"editor":null},"$preview":{"width":600,"height":700}}
class Component extends DCLogic {
  renderVals() {
    const editing = (this.props.mode ?? 'edit') === 'edit';
    return {
      editing,
      heading: editing ? 'Editar usuario' : 'Nuevo usuario',
      saveLabel: editing ? 'Guardar cambios' : 'Crear usuario',
      pwdLabel: editing ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña',
      username: editing ? 'editor01' : '',
      close: () => this.props.onClose && this.props.onClose()
    };
  }
}

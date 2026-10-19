// props: {"mode":{"editor":"enum","options":["edit","create"],"default":"edit"},"onClose":{"editor":null},"$preview":{"width":600,"height":880}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { picked: { Anime: true, 'Acción': true, Aventura: true } };
  }
  renderVals() {
    const create = (this.props.mode ?? 'edit') === 'create';
    const cats = ['Anime', 'Caricatura', 'Comedia', 'Acción', 'Aventura', 'Live action'].map((name) => {
      const on = !!this.state.picked[name];
      return {
        name,
        pressed: on ? 'true' : 'false',
        toggle: () => this.setState({ picked: { ...this.state.picked, [name]: !on } }),
        style: 'min-height: 36px; padding: 0 12px; border-radius: 18px; cursor: pointer; font: 500 13px \'IBM Plex Sans\', sans-serif; '
          + (on ? 'border: 1px solid #FFB547; background: #FFB547; color: #1A1206;' : 'border: 1px solid #3A3A33; background: transparent; color: #ECE8DC;')
      };
    });
    return {
      cats,
      heading: create ? 'Nueva serie' : 'Editar serie',
      saveLabel: create ? 'Crear serie' : 'Guardar cambios',
      name: create ? '' : 'Dragon Ball Z',
      close: () => this.props.onClose && this.props.onClose()
    };
  }
}

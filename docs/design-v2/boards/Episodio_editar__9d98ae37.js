// props: {"mode":{"editor":"enum","options":["edit","create"],"default":"edit"},"episodeTitle":{"editor":null},"onClose":{"editor":null},"$preview":{"width":600,"height":660}}
class Component extends DCLogic {
  renderVals() {
    const create = (this.props.mode ?? 'edit') === 'create';
    return {
      heading: create ? 'Nuevo episodio' : 'Editar episodio',
      title: create ? '' : (this.props.episodeTitle ?? 'El poder oculto de Gohan'),
      close: () => this.props.onClose && this.props.onClose()
    };
  }
}

// props: {"heading":{"editor":"text","default":"¿Eliminar la serie Dragon Ball Z?"},"message":{"editor":"text","default":"Se ocultará del catálogo y de todas las eras donde está asignada. Los archivos en disco no se borran."},"confirmLabel":{"editor":"text","default":"Eliminar serie"},"tone":{"editor":"enum","options":["danger","warning"],"default":"danger"},"onClose":{"editor":null},"$preview":{"width":600,"height":340}}
class Component extends DCLogic {
  renderVals() {
    const danger = (this.props.tone ?? 'danger') === 'danger';
    return {
      heading: this.props.heading ?? '¿Eliminar la serie Dragon Ball Z?',
      message: this.props.message ?? 'Se ocultará del catálogo y de todas las eras donde está asignada. Los archivos en disco no se borran.',
      confirmLabel: this.props.confirmLabel ?? 'Eliminar serie',
      iconBg: danger ? '#3A1F1B' : '#3A3122',
      iconInk: danger ? '#FF8A80' : '#FFB547',
      confirmStyle: 'min-height: 44px; padding: 0 18px; border: 0; border-radius: 6px; cursor: pointer; font: 600 14px \'IBM Plex Sans\', sans-serif; '
        + (danger ? 'background: #FF6B5E; color: #1A0906;' : 'background: #FFB547; color: #1A1206;'),
      close: () => this.props.onClose && this.props.onClose()
    };
  }
}

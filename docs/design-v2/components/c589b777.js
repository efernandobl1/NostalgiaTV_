// props: {"onClose":{"editor":null},"$preview":{"width":600,"height":700}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { on: { Completed: true, Skipped: true, Failed: false, Queued: false }, typed: '' };
  }
  renderVals() {
    const defs = [
      ['Completed', 'Completados', 'Solo borra el registro, no el archivo de salida', 1309, '#8BE08F'],
      ['Skipped', 'Omitidos', 'Archivos sin cambios desde el último análisis', 5, '#8C887D'],
      ['Failed', 'Fallidos', 'Se pierde el mensaje de error', 7, '#FF8A80'],
      ['Queued', 'En cola (cancelar)', 'Se vuelven a crear al escanear la carpeta', 18, '#A29E91']
    ];
    const statuses = defs.map(([key, label, hint, count, color]) => ({
      label, hint, count, color,
      on: !!this.state.on[key],
      toggle: () => this.setState({ on: { ...this.state.on, [key]: !this.state.on[key] } })
    }));
    const total = defs.reduce((n, d) => n + (this.state.on[d[0]] ? d[3] : 0), 0);
    const locked = total === 0 || this.state.typed.trim().toUpperCase() !== 'LIMPIAR';
    return {
      statuses,
      total: total.toLocaleString('es-GT'),
      typed: this.state.typed,
      setTyped: (e) => this.setState({ typed: e.target.value }),
      locked,
      dangerStyle: 'min-height: 44px; padding: 0 18px; border: 0; border-radius: 6px; font: 600 14px \'IBM Plex Sans\', sans-serif; '
        + (locked ? 'background: #3A3A33; color: #8C887D; cursor: not-allowed;' : 'background: #FF6B5E; color: #1A0906; cursor: pointer;'),
      close: () => this.props.onClose && this.props.onClose()
    };
  }
}

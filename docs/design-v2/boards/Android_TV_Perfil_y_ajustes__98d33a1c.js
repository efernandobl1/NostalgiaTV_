// props: {"$preview":{"width":1920,"height":1080}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { sec: 1 };
  }
  renderVals() {
    const S = [
      ['Perfil', [
        ['Usuario', 'Cuenta de espectador', 'fernando'],
        ['Historial de visualización', '128 episodios · se sincroniza con la web', 'Ver ›'],
        ['Borrar historial', 'Elimina el progreso de todas las series', '›', 'danger'],
        ['Cerrar sesión en este TV', 'Tendrás que vincularlo de nuevo', '›', 'danger']
      ]],
      ['Reproducción', [
        ['Iniciar en el último canal', 'Al abrir la app sintoniza CH 05', 'SÍ', 'on'],
        ['Mostrar número al cambiar de canal', 'Número verde estilo TV de tubo', 'SÍ', 'on'],
        ['Efectos de temporada', 'Halloween y Navidad en pantalla', 'SÍ', 'on'],
        ['Calidad de video', 'Se ajusta a tu conexión', 'AUTOMÁTICA']
      ]],
      ['Subtítulos', [
        ['Subtítulos', 'Cuando el episodio los tenga', 'NO'],
        ['Tamaño', 'Texto de los subtítulos', 'GRANDE'],
        ['Fondo', 'Mejora la lectura', 'SEMITRANSPARENTE']
      ]],
      ['Dispositivo', [
        ['Nombre', 'Así aparece en Mis dispositivos', 'Smart TV sala'],
        ['Sesión válida hasta', 'Se renueva al usar la app', '16 NOV 2026'],
        ['Desvincular este TV', 'Cierra la sesión y borra el código', '›', 'danger']
      ]],
      ['Acerca de', [
        ['Versión de la app', 'Android TV', '2.0.0'],
        ['Servidor', 'Donde está tu NostalgiaTV', 'TU-SERVIDOR'],
        ['Buscar actualizaciones', 'Última revisión hoy', '›']
      ]]
    ];
    const i = this.state.sec;
    const sections = S.map(([label], k) => ({
      label,
      pick: () => this.setState({ sec: k }),
      style: 'height: 80px; display: flex; align-items: center; padding: 0 32px; border: 0; border-radius: 40px; cursor: pointer; font: 600 26px \'IBM Plex Sans\', sans-serif; '
        + (k === i ? 'background: #ECE8DC; color: #0B0B09; box-shadow: 0 0 0 4px #0B0B09, 0 0 0 8px #FFB547;' : 'background: transparent; color: #D6D2C6;')
    }));
    const rows = S[i][1].map(([label, hint, value, kind], k) => ({
      label, hint, value,
      ink: kind === 'danger' ? '#FF8A80' : '#ECE8DC',
      valueColor: kind === 'on' ? '#8BE08F' : '#D6D2C6',
      style: 'display: flex; align-items: center; gap: 24px; min-height: 104px; padding: 0 28px; border-radius: 18px; '
        + (k === 0 ? 'background: #24241F; box-shadow: inset 0 0 0 2px #3A3A33;' : '')
    }));
    return { sections, rows, title: S[i][0] };
  }
}

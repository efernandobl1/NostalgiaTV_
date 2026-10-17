// props: {"active":{"editor":"enum","options":["summary","schedule","channels","series","interludes","viewers","comments","media","access","settings"],"default":"summary"},"$preview":{"width":248,"height":960}}
class Component extends DCLogic {
  renderVals() {
    const active = this.props.active ?? 'summary';
    const base = 'display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 10px; border-radius: 6px; text-decoration: none; font-size: 14px;';
    const item = (key, ch, label, href, badge) => {
      const on = key === active;
      return {
        ch, label, href,
        badge: badge || '',
        hasBadge: !!badge,
        current: on ? 'page' : 'false',
        chColor: on ? '#1A1206' : '#8C887D',
        style: base + (on ? ' color: #1A1206; background: #FFB547; font-weight: 600;' : ' color: #D6D2C6; background: transparent;')
      };
    };
    return {
      groups: [
        { label: 'OPERACIÓN', items: [
          item('summary', '01', 'Resumen', 'Main.dc.html'),
          item('schedule', '02', 'Programación', 'Schedule.dc.html'),
          item('channels', '03', 'Canales y eras', 'Channels.dc.html')
        ] },
        { label: 'CATÁLOGO', items: [
          item('series', '04', 'Series y episodios', 'Series.dc.html'),
          item('interludes', '05', 'Interludios', 'Interludes.dc.html')
        ] },
        { label: 'AUDIENCIA', items: [
          item('viewers', '06', 'Espectadores', 'Viewers.dc.html'),
          item('comments', '07', 'Comentarios', 'Comments.dc.html', '12')
        ] },
        { label: 'SISTEMA', items: [
          item('media', '08', 'Procesamiento', 'Media.dc.html', '3'),
          item('access', '09', 'Acceso', 'Access.dc.html'),
          item('settings', '10', 'Ajustes', 'Settings.dc.html')
        ] }
      ]
    };
  }
}

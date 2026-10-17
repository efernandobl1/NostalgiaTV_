// props: {"$preview":{"width":1440,"height":1200}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { tab: 0, role: 0, dlg: null, mode: 'edit', target: '' };
  }
  renderVals() {
    const tabs = ['Usuarios', 'Roles y menús', 'Registro de actividad'].map((label, i) => {
      const on = i === this.state.tab;
      return {
        label, selected: on ? 'true' : 'false', pick: () => this.setState({ tab: i }),
        style: 'min-height: 44px; padding: 0 16px; border: 0; margin-bottom: -1px; background: transparent; cursor: pointer; font: 500 14px \'IBM Plex Sans\', sans-serif; '
          + (on ? 'color: #FFB547; border-bottom: 2px solid #FFB547;' : 'color: #A29E91; border-bottom: 2px solid transparent;')
      };
    });
    const ok = '#8BE08F', warn = '#FFB547', bad = '#FF8A80';
    const users = [
      { name: 'admin', role: 'Administrador', ext: '—', status: 'Activo', stColor: ok, sessions: '2 activas' },
      { name: 'fernando', role: 'Administrador', ext: 'Google', status: 'Activo', stColor: ok, sessions: '3 activas' },
      { name: 'maria.g', role: 'Espectador', ext: 'Google', status: 'Activo', stColor: ok, sessions: '1 activa' },
      { name: 'editor01', role: 'Editor', ext: '—', status: '3 intentos fallidos', stColor: warn, sessions: '0' },
      { name: 'jpablo', role: 'Espectador', ext: '—', status: 'Bloqueado hasta 15:10', stColor: bad, sessions: '0' },
      { name: 'lucia', role: 'Espectador', ext: 'Google', status: 'Activo', stColor: ok, sessions: '1 activa' }
    ];
    users.forEach((u) => {
      u.edit = () => this.setState({ dlg: 'user', mode: 'edit' });
      u.revoke = () => this.setState({ dlg: 'revoke', target: u.name });
    });
    const roleDefs = [
      ['Administrador', 'Acceso completo al panel', false],
      ['Editor', 'Catálogo, canales y programación', false],
      ['Espectador', 'Rol asignado al registrarse', true]
    ];
    const roles = roleDefs.map(([name, desc, viewer], i) => {
      const on = i === this.state.role;
      return {
        name, desc, viewer,
        pressed: on ? 'true' : 'false',
        pick: () => this.setState({ role: i }),
        style: 'display: flex; flex-direction: column; align-items: flex-start; gap: 4px; width: 100%; padding: 12px 14px; border-radius: 10px; cursor: pointer; font: inherit; '
          + (on ? 'border: 1px solid #FFB547; background: #24231C;' : 'border: 1px solid #2C2C27; background: #171714;')
      };
    });
    const r = this.state.role;
    const menuDefs = [
      ['Operación', '', 0, [1, 1, 0]], ['Resumen', '/dashboard', 1, [1, 1, 0]], ['Programación', '/dashboard/schedule', 1, [1, 1, 0]], ['Canales y eras', '/dashboard/channels', 1, [1, 1, 0]],
      ['Catálogo', '', 0, [1, 1, 0]], ['Series y episodios', '/dashboard/series', 1, [1, 1, 0]], ['Interludios', '/dashboard/interludes', 1, [1, 1, 0]],
      ['Audiencia', '', 0, [1, 0, 0]], ['Comentarios', '/dashboard/comments', 1, [1, 1, 0]],
      ['Sistema', '', 0, [1, 0, 0]], ['Acceso', '/dashboard/access', 1, [1, 0, 0]], ['Ajustes', '/dashboard/settings', 1, [1, 0, 0]]
    ];
    const menus = menuDefs.map(([caption, url, depth, on]) => ({
      caption, url, on: !!on[r],
      style: 'display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 10px 0 ' + (10 + depth * 28) + 'px; border-top: 1px solid #24241F; font-size: 14px; cursor: pointer;' + (depth ? '' : ' font-weight: 600;')
    }));
    const d = this.state.dlg;
    return {
      tabs, users, roles, menus,
      mode: this.state.mode,
      target: this.state.target,
      dlg: { user: d === 'user', role: d === 'role', revoke: d === 'revoke' },
      open: {
        newUser: () => this.setState({ dlg: 'user', mode: 'create' }),
        newRole: () => this.setState({ dlg: 'role', mode: 'create' }),
        editRole: () => this.setState({ dlg: 'role', mode: 'edit' })
      },
      close: () => this.setState({ dlg: null }),
      role: roles[r],
      showUsers: this.state.tab === 0,
      showRoles: this.state.tab === 1,
      showLog: this.state.tab === 2,
      log: [
        { at: '2026-10-17 20:28', user: 'admin', action: 'comment.approve', resource: 'comments/2231', desc: 'Aprobó 3 comentarios' },
        { at: '2026-10-17 20:10', user: 'fernando', action: 'channel.era.select', resource: 'channels/5', desc: 'Era activa: Época dorada' },
        { at: '2026-10-17 19:57', user: 'sistema', action: 'schedule.generate', resource: 'channels/23', desc: 'Programación regenerada' },
        { at: '2026-10-17 19:41', user: 'fernando', action: 'interlude.create', resource: 'interludes/88', desc: 'Subió bumper Ya viene' },
        { at: '2026-10-17 19:02', user: 'admin', action: 'metadata.import', resource: 'series/42', desc: 'TMDB · es-MX' },
        { at: '2026-10-17 18:40', user: 'sistema', action: 'tokens.cleanup', resource: 'refresh-tokens', desc: '37 tokens expirados eliminados' },
        { at: '2026-10-17 18:12', user: 'jpablo', action: 'auth.lockout', resource: 'users/14', desc: 'Bloqueado por intentos fallidos' }
      ]
    };
  }
}

// props: {"$preview":{"width":1440,"height":1200}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { tab: 0, sel: {}, all: false, dlg: null };
  }
  renderVals() {
    const C = { Queued: ['EN COLA', '#A29E91'], Processing: ['PROCESANDO', '#6FD0EA'], Completed: ['COMPLETADO', '#8BE08F'], Failed: ['FALLIDO', '#FF8A80'], Skipped: ['OMITIDO', '#8C887D'] };
    const tabDefs = [['Todos', 'All', 1342], ['En cola', 'Queued', 18], ['Procesando', 'Processing', 3], ['Completados', 'Completed', 1309], ['Fallidos', 'Failed', 7], ['Omitidos', 'Skipped', 5]];
    const tabs = tabDefs.map(([label, key, count], i) => {
      const on = i === this.state.tab;
      return {
        label, count, pressed: on ? 'true' : 'false', pick: () => this.setState({ tab: i }),
        style: 'min-height: 40px; padding: 0 14px; border-radius: 20px; cursor: pointer; font: 500 13px \'IBM Plex Sans\', sans-serif; '
          + (on ? 'border: 1px solid #FFB547; background: #FFB547; color: #1A1206;' : 'border: 1px solid #3A3A33; background: transparent; color: #ECE8DC;')
      };
    });
    const all = [
      ['Pokémon', 'transcode', '/media/series/pokemon/T03/E02.mkv', '1.2 GB', 62, 'Processing', 'h264 → 720p'],
      ['Digimon Adventure', 'transcode', '/media/series/digimon/T01/E44.avi', '640 MB', 18, 'Processing', 'h264 → 720p'],
      ['Hey Arnold!', 'probe', '/media/series/hey-arnold/T02/E09.mp4', '410 MB', 90, 'Processing', 'Leyendo metadatos'],
      ['Los Simpson', 'thumbnails', '/media/series/simpson/T05/E01.mkv', '980 MB', 0, 'Queued', '—'],
      ['Dragon Ball Z', 'transcode', '/media/series/dbz/T04/E12.mkv', '1.4 GB', 100, 'Failed', 'Stream de audio inválido'],
      ['Dragon Ball Z', 'transcode', '/media/series/dbz/T04/E11.mkv', '1.4 GB', 100, 'Completed', 'OK · 21:38'],
      ['Los Caballeros del Zodiaco', 'probe', '/media/series/saint-seiya/T01/E31.mp4', '520 MB', 100, 'Skipped', 'Huella sin cambios']
    ];
    const key = tabDefs[this.state.tab][1];
    const sel = this.state.sel;
    const jobs = all
      .map((j, id) => ({ j, id }))
      .filter(({ j }) => key === 'All' || j[5] === key)
      .map(({ j: [series, worker, path, size, progress, st, msg], id }) => ({
        series, worker, path, size, progress, msg, status: C[st][0], color: C[st][1],
        selected: !!sel[id],
        rowStyle: sel[id] ? 'background: #221D12' : '',
        toggle: () => this.setState({ sel: { ...sel, [id]: !sel[id] }, all: false })
      }));
    const matchingNum = tabDefs[this.state.tab][2];
    const picked = Object.values(sel).filter(Boolean).length;
    const selCount = this.state.all ? matchingNum : picked;
    const allOnPage = jobs.length > 0 && jobs.every((j) => j.selected);
    const pageIds = all.map((j, id) => id).filter((id) => key === 'All' || all[id][5] === key);
    const fmt = (n) => n.toLocaleString('es-GT');
    const pages = ['1', '2', '3', '…', String(Math.max(1, Math.ceil(matchingNum / 50)))].map((label, i) => ({
      label,
      current: i === 0 ? 'page' : 'false',
      style: 'min-width: 36px; height: 36px; padding: 0 8px; border-radius: 6px; font: 500 13px \'IBM Plex Mono\', monospace; cursor: pointer; '
        + (i === 0 ? 'border: 1px solid #FFB547; background: #FFB547; color: #1A1206;' : 'border: 1px solid #3A3A33; background: transparent; color: #ECE8DC;')
    }));
    return {
      tabs, jobs, pages,
      hasSel: selCount > 0,
      selCount: fmt(selCount),
      matching: fmt(matchingNum),
      allOnPage,
      togglePage: () => {
        const next = { ...sel };
        pageIds.forEach((id) => { next[id] = !allOnPage; });
        this.setState({ sel: next, all: false });
      },
      selectAllMatching: () => this.setState({ all: true }),
      clearSel: () => this.setState({ sel: {}, all: false }),
      dlgClear: this.state.dlg === 'clear',
      dlgDelete: this.state.dlg === 'delete',
      delHeading: '¿Eliminar ' + fmt(selCount) + ' jobs seleccionados?',
      openClear: () => this.setState({ dlg: 'clear' }),
      openDeleteSel: () => this.setState({ dlg: 'delete' }),
      close: () => this.setState({ dlg: null }),
      workers: [
        { id: 'transcode', enabled: true, color: '#8BE08F', beat: 'Latido hace 4 s', load: '2 jobs · 4 / 4 núcleos' },
        { id: 'probe', enabled: true, color: '#8BE08F', beat: 'Latido hace 9 s', load: '1 job' },
        { id: 'thumbnails', enabled: false, color: '#A29E91', beat: 'Sin latido · deshabilitado', load: '0 jobs' }
      ]
    };
  }
}

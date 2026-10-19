// props: {"$preview":{"width":1440,"height":1300}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { cat: 0, series: 0, season: 2, ep: 1, dlg: null, mode: 'edit', confirm: null };
  }
  chip(on) {
    return 'min-height: 40px; padding: 0 14px; border-radius: 20px; cursor: pointer; font: 500 13px \'IBM Plex Sans\', sans-serif; '
      + (on ? 'border: 1px solid #FFB547; background: #FFB547; color: #1A1206;' : 'border: 1px solid #3A3A33; background: transparent; color: #ECE8DC;');
  }
  renderVals() {
    const cats = ['Todas', 'Anime', 'Caricatura', 'Comedia', 'Live action'].map((name, i) => ({
      name, pressed: i === this.state.cat ? 'true' : 'false', style: this.chip(i === this.state.cat), pick: () => this.setState({ cat: i })
    }));
    const raw = [
      ['Dragon Ball Z', '1989–1996', 9, '291 / 291 archivos'],
      ['Los Simpson', '1989 –', 12, '262 / 270 archivos', true],
      ['Hey Arnold!', '1996–2004', 5, '100 / 100 archivos'],
      ['Pokémon', '1997 –', 4, '210 / 228 archivos', true],
      ['Digimon Adventure', '1999–2000', 1, '54 / 54 archivos'],
      ['Los Caballeros del Zodiaco', '1986–1989', 5, '114 / 114 archivos']
    ];
    const series = raw.map(([name, years, seasons, files, warn], i) => {
      const on = i === this.state.series;
      return {
        name, years, seasons, files,
        warnColor: warn ? '#FFB547' : '#A29E91',
        pressed: on ? 'true' : 'false',
        pick: () => this.setState({ series: i }),
        style: 'display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px; border-radius: 10px; cursor: pointer; font: inherit; '
          + (on ? 'border: 1px solid #FFB547; background: #24231C;' : 'border: 1px solid #2C2C27; background: #171714;')
      };
    });
    const seasons = ['T0 · Especiales', 'T1', 'T2', 'T3', 'T4'].map((label, i) => ({
      label, pressed: i === this.state.season ? 'true' : 'false', style: this.chip(i === this.state.season), pick: () => this.setState({ season: i })
    }));
    const epRaw = [
      ['E13', 'La llegada de Freezer', 'Episodio', 'dbz_t2_e13.mp4', true, [32, 66]],
      ['E14', 'El poder oculto de Gohan', 'Episodio', 'dbz_t2_e14.mp4', true, [33, 67]],
      ['E15', 'Vegeta contra Zarbon', 'Episodio', 'dbz_t2_e15.mp4', true, [31, 64]],
      ['E16', 'Las esferas de Namek', 'Episodio', 'sin archivo', false, []],
      ['E17', 'Resumen de la saga', 'Relleno', 'dbz_t2_e17.mp4', true, [50]],
      ['OP', 'Opening 1', 'Opening', 'dbz_op1.mp4', true, []],
      ['ED', 'Ending 1', 'Ending', 'dbz_ed1.mp4', true, []]
    ];
    const show = (dlg, extra) => () => this.setState({ dlg, ...extra });
    const episodes = epRaw.map(([num, title, type, file, ok, marks], i) => ({
      num, title, type, file, marks,
      fileColor: ok ? '#A29E91' : '#FF6B5E',
      rowStyle: i === this.state.ep ? 'background: #24231C' : '',
      pick: () => this.setState({ ep: i }),
      edit: show('episode', { ep: i, mode: 'edit' }),
      remove: show('confirm', { confirm: {
        heading: '¿Eliminar ' + num + ' · ' + title + '?',
        message: 'Se quitará de la programación futura y se borrarán sus puntos de corte. El archivo de video no se elimina.',
        label: 'Eliminar episodio'
      } })
    }));
    const ep = episodes[this.state.ep];
    const bps = ep.marks.map((p, i) => ({ pct: p, at: i === 0 ? '07:12.400' : '14:30.000', label: i === 0 ? 'Corte A' : 'Corte B' }));
    const d = this.state.dlg;
    return {
      cats, series, seasons, episodes, ep, bps,
      noBps: bps.length === 0,
      dlg: { series: d === 'series', episode: d === 'episode', season: d === 'season', breakpoint: d === 'breakpoint', import: d === 'import', confirm: d === 'confirm' },
      open: {
        newSeries: show('series', { mode: 'create' }),
        editSeries: show('series', { mode: 'edit' }),
        newEpisode: show('episode', { mode: 'create' }),
        season: show('season'),
        breakpoint: show('breakpoint'),
        import: show('import'),
        deleteSeries: show('confirm', { confirm: {
          heading: '¿Eliminar la serie Dragon Ball Z?',
          message: 'Se ocultará del catálogo y de todas las eras donde está asignada. Los archivos en disco no se borran.',
          label: 'Eliminar serie'
        } })
      },
      seriesMode: this.state.mode,
      episodeMode: this.state.mode,
      editTitle: ep.title,
      confirm: this.state.confirm || { heading: '', message: '', label: '' },
      close: () => this.setState({ dlg: null }),
      extIds: [
        { provider: 'TMDB', id: '12971', run: 'Última importación: completada · es-MX · 12 oct', color: '#8BE08F' },
        { provider: 'TheTVDB', id: '81472', run: 'Última importación: fallida · 03 oct', color: '#FF6B5E' }
      ]
    };
  }
}

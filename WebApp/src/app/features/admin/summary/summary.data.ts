const amber = '#FFB547', cyan = '#6FD0EA', green = '#8BE08F', red = '#FF6B5E', muted = '#A29E91';
const onAir = { status: 'AL AIRE', statusInk: '#1A0906', statusBg: red };

export const SUMMARY = {
  kpis: [
    { label: 'CANALES AL AIRE', value: '4', unit: '/ 5', note: '1 canal sin era seleccionada', color: '#ECE8DC', href: '/admin/canales' },
    { label: 'EPISODIOS DISPONIBLES', value: '1 284', unit: '/ 1 310', note: '26 sin archivo en 3 series', color: '#ECE8DC', href: '/admin/series' },
    { label: 'COLA DE MEDIA', value: '21', unit: 'jobs', note: '3 procesando · 2 fallidos hoy', color: cyan, href: '/admin/media' },
    { label: 'COMENTARIOS PENDIENTES', value: '12', unit: '', note: 'El más antiguo: hace 2 h', color: amber, href: '/admin/comentarios' },
  ],
  channels: [
    { ...onAir, code: 'CH 05', name: 'Canal 5 Retro', era: 'Época dorada 1996–2001', nowCode: 'T2 · E14', nowTitle: 'Dragon Ball Z', pct: 34, next: 'CORTE · 3 anuncios en 02:18' },
    { ...onAir, code: 'CH 12', name: 'Cartoon Clásico', era: 'Fines de los 90', nowCode: 'T1 · E07', nowTitle: 'Hey Arnold!', pct: 71, next: 'BUMPER · Ya viene en 00:42' },
    { ...onAir, code: 'CH 23', name: 'Anime 90s', era: 'Tardes de anime', nowCode: 'T1 · E31', nowTitle: 'Los Caballeros del Zodiaco', pct: 12, next: 'CORTE · 2 anuncios en 08:05' },
    { ...onAir, code: 'CH 31', name: 'Tarde de Sábado', era: 'Sábados 2003', nowCode: 'ESPECIAL', nowTitle: 'Digimon: La película', pct: 58, next: 'SIGUE · Pokémon T3 · E02' },
    { status: 'SIN ERA', statusInk: '#ECE8DC', statusBg: '#3A3A33', code: 'CH 40', name: 'Noche Retro', era: 'sin seleccionar', nowCode: 'FUERA DEL AIRE', nowTitle: 'Selecciona una era para emitir', pct: 0, next: 'Configurar en Canales y eras' },
  ],
  jobs: [
    { series: 'Pokémon', worker: 'transcode', file: 'pokemon/T03/E02.mkv', status: 'PROCESANDO 62%', progress: 62, color: cyan },
    { series: 'Digimon Adventure', worker: 'transcode', file: 'digimon/T01/E44.avi', status: 'PROCESANDO 18%', progress: 18, color: cyan },
    { series: 'Hey Arnold!', worker: 'probe', file: 'hey-arnold/T02/E09.mp4', status: 'PROCESANDO 90%', progress: 90, color: cyan },
    { series: 'Dragon Ball Z', worker: 'transcode', file: 'dbz/T04/E12.mkv', status: 'FALLIDO', progress: 100, color: red },
    { series: 'Los Simpson', worker: 'thumbnails', file: 'simpson/T05/E01.mkv', status: 'EN COLA', progress: 0, color: muted },
  ],
  activity: [
    { time: '14:28', user: 'admin', action: 'aprobó 3 comentarios', resource: 'comments/series/118' },
    { time: '14:10', user: 'fernando', action: 'cambió la era activa', resource: 'channels/5/eras/12' },
    { time: '13:57', user: 'sistema', action: 'regeneró la programación', resource: 'channels/23/schedule' },
    { time: '13:41', user: 'fernando', action: 'subió un interludio', resource: 'interludes/88 · Bumper Ya viene' },
    { time: '13:02', user: 'admin', action: 'importó metadatos', resource: 'series/42 · TMDB · es-MX' },
    { time: '12:40', user: 'sistema', action: 'limpió tokens expirados', resource: 'refresh-tokens · 37' },
  ],
  workers: [
    { id: 'transcode', state: 'Activo · latido hace 4 s', color: green },
    { id: 'probe', state: 'Activo · latido hace 9 s', color: green },
    { id: 'thumbnails', state: 'Pausado', color: muted },
  ],
};

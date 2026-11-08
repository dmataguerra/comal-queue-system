// Traceability: catalog case -> executable checks.
//   unit:        [test file, --test-name-pattern regex]; each pattern must match >= 1 test
//   smoke:       existing Electron/Node smoke suites (scripts/smoke-*.mjs)
//   selenium:    scenario IDs in qa/automation/ui.mjs
//   integration: Comal -> Selenium -> TestLink smoke (qa/automation/integration.mjs)
//   manual:      part of the expected result that needs physical hardware or a human; the case
//                is reported BLOCKED (never PASS) until that part is executed, even when every
//                automated check passes.
export const CASES = {
  'COMAL-QA-001': { selenium: ['COMAL-QA-001'], integration: true },
  'COMAL-QA-002': {
    unit: [
      ['nucleo/turnos.test.ts', '6 dígitos|un dígito'],
      ['nucleo/turnos-propiedades.test.ts', 'seis dígitos'],
    ],
    selenium: ['COMAL-QA-002'],
  },
  'COMAL-QA-003': {
    unit: [
      ['nucleo/turnos.test.ts', 'vacío, letras'],
      ['main/store.test.ts', 'captura inválida'],
    ],
    selenium: ['COMAL-QA-003'],
  },
  'COMAL-QA-004': {
    unit: [
      ['nucleo/turnos.test.ts', 'número nuevo'],
      ['nucleo/turnos-propiedades.test.ts', 'modelo de seis turnos'],
    ],
    selenium: ['COMAL-QA-004'],
  },
  'COMAL-QA-005': {
    unit: [
      ['main/vigencia.test.ts', '5 minutos exactos|cada número cuenta|reinicia los 5 minutos'],
      ['nucleo/turnos.test.ts', 'vencidos|vence el actual|ningún vencido'],
    ],
  },
  'COMAL-QA-006': {
    unit: [
      ['main/entregas-audio.test.ts', 'saturación'],
      ['nucleo/cola.test.ts', 'limita activo'],
    ],
    smoke: ['hardening'],
  },
  'COMAL-QA-007': {
    unit: [['main/servidor-web-qa.test.ts', 'ráfaga de 100']],
    manual:
      'La latencia Enter→pantalla/sonido (<1 s) debe medirse en el equipo físico identificado; el automatizado solo cubre una ráfaga HTTP.',
  },
  'COMAL-QA-008': {
    unit: [
      ['nucleo/turnos.test.ts', 'ya es el actual'],
      ['main/store.test.ts', 'también al repetir'],
    ],
    selenium: ['COMAL-QA-008'],
  },
  'COMAL-QA-009': {
    unit: [['nucleo/turnos.test.ts', 'número en la lista']],
    selenium: ['COMAL-QA-009'],
  },
  'COMAL-QA-010': {
    unit: [['nucleo/turnos.test.ts', 'ya salió de la lista']],
    selenium: ['COMAL-QA-010'],
  },
  'COMAL-QA-011': {
    unit: [
      ['nucleo/turnos.test.ts', 'restaura el estado previo|sin llamado previo|dos veces seguidas'],
      ['main/store.test.ts', 'deshacer difunde'],
    ],
    selenium: ['COMAL-QA-011'],
  },
  'COMAL-QA-012': {
    unit: [
      ['main/vigencia.test.ts', 'deshacer después de un vencimiento'],
      ['main/store.test.ts', 'sobrevive a reabrir'],
      ['main/persistencia.test.ts', 'deshacer no se persiste'],
      ['nucleo/turnos.test.ts', 'conserva deshacer|ya no hay qué deshacer'],
    ],
  },
  'COMAL-QA-013': {
    unit: [
      ['main/entregas-audio.test.ts', 'dos llamadas del mismo número'],
      ['nucleo/cola.test.ts', '55 termina antes de 66'],
    ],
    smoke: ['media'],
  },
  'COMAL-QA-014': {
    unit: [
      ['nucleo/cola.test.ts', 'watchdog|descarta por espera'],
      ['main/entregas-audio.test.ts', 'caducidad'],
      ['scripts/audio-lifecycle.test.mjs', 'audio:'],
    ],
  },
  'COMAL-QA-015': {
    unit: [['nucleo/cola.test.ts', 'un fallo permite continuar']],
    smoke: ['audio-controls'],
    manual: 'Confirmar en el equipo físico que la voz ausente/volumen 0 no produce sonido.',
  },
  'COMAL-QA-016': {
    unit: [
      ['main/volumen-youtube.test.ts', '.'],
      ['scripts/youtube-lifecycle.test.mjs', 'ducking'],
    ],
    smoke: ['media'],
    manual: 'Comprobar de oído la atenuación y recuperación del video en la TV/altavoces reales.',
  },
  'COMAL-QA-017': {
    unit: [['main/contenido.test.ts', 'inventario']],
    smoke: ['destructive', 'background'],
    manual: 'YouTube de escritorio requiere Internet real y aceptación en la instalación objetivo.',
  },
  'COMAL-QA-018': {
    unit: [['main/contenido.test.ts', 'inventario']],
    smoke: ['destructive', 'media'],
  },
  'COMAL-QA-019': {
    unit: [
      ['main/store.test.ts', 'un fallo persistente'],
      ['main/espacio-estado.test.ts', '.'],
      ['main/escritura-atomica.test.ts', '.'],
    ],
    smoke: ['hardening'],
  },
  'COMAL-QA-020': {
    unit: [
      ['main/persistencia.test.ts', 'reinicio diario|la fecha de la jornada'],
      ['main/reinicio-diario.test.ts', '.'],
      ['main/store.test.ts', 'cambio de día|sobrevive a reabrir'],
      ['main/vigencia.test.ts', 'al reabrir'],
    ],
  },
  'COMAL-QA-021': {
    unit: [
      ['main/persistencia.test.ts', 'dañado|corrupto|E/S'],
      ['main/config.test.ts', 'JSON dañado'],
      ['main/migracion-02.test.ts', '.'],
      ['main/carpeta-datos.test.ts', '.'],
      ['main/store.test.ts', 'estado inicial estaba corrupto'],
    ],
  },
  'COMAL-QA-022': {
    smoke: ['desktop'],
    manual: 'Requiere 1 y 2 monitores físicos y desconectar/reconectar la TV.',
  },
  'COMAL-QA-023': {
    smoke: ['full-day-preflight', 'desktop'],
    manual:
      'La jornada monitorizada completa (npm run test:full-day, 6.5 h) y sin Internet debe ejecutarse en el equipo objetivo.',
  },
  'COMAL-QA-024': {
    unit: [
      ['main/seguridad-ipc.test.ts', 'volúmenes|volumen'],
      ['main/servidor-web.test.ts', '.'],
    ],
    smoke: ['audio-controls'],
  },
  'COMAL-QA-025': {
    unit: [
      ['main/config.test.ts', 'valores parciales|clave heredada|JSON dañado|config.json ausente'],
    ],
    smoke: ['media'],
  },
  'COMAL-QA-026': {
    unit: [['main/contenido.test.ts', 'administración: importa|inventario|protocolo sirve MP3']],
    smoke: ['media'],
  },
  'COMAL-QA-027': {
    unit: [
      ['main/contenido.test.ts', 'importación rechaza|archivo vacío|copia truncada|copia lenta'],
    ],
    smoke: ['hardening'],
  },
  'COMAL-QA-028': {
    unit: [['main/contenido.test.ts', 'importa sin sobrescribir|reemplazar una voz|concurrentes']],
    smoke: ['destructive'],
  },
  'COMAL-QA-029': {
    unit: [
      ['nucleo/youtube.test.ts', '.'],
      ['scripts/youtube-lifecycle.test.mjs', 'sin video o transporte'],
    ],
    smoke: ['browser'],
    manual:
      'La pérdida de red real con YouTube de escritorio requiere Internet en el equipo objetivo.',
  },
  'COMAL-QA-030': {
    unit: [
      ['nucleo/turnos.test.ts', 'quitar\\(\\)'],
      ['main/store.test.ts', 'quitar difunde'],
    ],
    smoke: ['interface'],
    selenium: ['COMAL-QA-030'],
  },
  'COMAL-QA-031': { smoke: ['interface'], selenium: ['COMAL-QA-031'] },
  'COMAL-QA-032': { smoke: ['help', 'accessibility'], selenium: ['COMAL-QA-032'] },
  'COMAL-QA-033': { smoke: ['help'] },
  'COMAL-QA-034': {
    unit: [
      ['main/manual-usuario.test.ts', '.'],
      ['main/safe-file.test.ts', '.'],
    ],
    smoke: ['help'],
  },
  'COMAL-QA-035': { unit: [['main/diagnostico.test.ts', '.']], smoke: ['desktop'] },
  'COMAL-QA-036': { smoke: ['theme', 'display-scale', 'interface'], selenium: ['COMAL-QA-036'] },
  'COMAL-QA-037': {
    smoke: ['accessibility', 'display-scale', 'background'],
    manual: 'La legibilidad a distancia en la TV física es una verificación humana.',
  },
  'COMAL-QA-038': {
    unit: [['main/servidor-web-qa.test.ts', 'SSE']],
    smoke: ['browser'],
    selenium: ['COMAL-QA-038'],
  },
  'COMAL-QA-039': {
    unit: [
      ['main/servidor-web-qa.test.ts', 'rechaza|limita cuerpos|conserva bytes|contiene errores'],
      ['main/politica-csp.test.ts', '.'],
    ],
    smoke: ['browser'],
  },
  'COMAL-QA-040': {
    unit: [
      ['main/seguridad-ipc.test.ts', 'IPC'],
      ['main/ipc-channels.test.ts', '.'],
    ],
  },
  'COMAL-QA-041': { integration: true },
  'COMAL-QA-042': { unit: [['main/respaldo.test.ts', '.']], smoke: ['recovery'] },
  'COMAL-QA-043': {
    manual:
      'Solo existe el instalador 0.3.0; se necesita el instalador 1.0.0 identificado y un Windows estándar para npm run test:installed / test:upgrade.',
  },
};

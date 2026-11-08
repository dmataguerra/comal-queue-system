import fs from 'node:fs';
const groups = [
  [
    'CU-01',
    'Llamar pedido listo',
    'nucleo/turnos.ts; backend/queue-store.ts',
    'Captura 1–6 dígitos; últimos 2; guarda antes de anunciar; actual+5 anteriores.',
    [
      [
        'Llamar 42 y sincronizar pública',
        'Capturar 42 y Enter en operador; observar ambas vistas.',
        'Actual 42 en operador y pública; captura limpia.',
        'Selenium',
        'P 0',
      ],
      [
        'Normalización y extremos',
        'Probar 213298, 8, 00, 99, 000000.',
        '98, 08, 00, 99, 00.',
        'Unit/API/Selenium',
        'P 0',
      ],
      [
        'Captura inválida',
        'Probar vacío, letras, signos, decimales y 7 dígitos.',
        'Sin mutación ni anuncio.',
        'Unit/API/Selenium',
        'P 0',
      ],
      [
        'Capacidad visual',
        'Llamar 7 números distintos esperando disponibilidad.',
        'Actual+5 anteriores únicos; sale más antiguo.',
        'Unit/Selenium',
        'P 0',
      ],
      [
        'Vencimiento',
        'Avanzar reloj antes/en 5 min; repetir antes de vencer.',
        'Solo vencidos salen; repetir renueva vigencia.',
        'Unit/integración',
        'P 0',
      ],
      [
        'Saturación audio',
        'Retener procesamiento y acumular 5, 6, 7 tareas.',
        'Aviso desde 5; séptima rechazada sin mutar ni limpiar captura.',
        'Unit/integración',
        'P 0',
      ],
      [
        'Latencia',
        'Medir Enter → estado visible/sonido con hardware identificado.',
        'Comparar requisito histórico<1 s y registrar distribución real.',
        'Rendimiento',
        'P 1',
      ],
    ],
  ],
  [
    'CU-02',
    'Rellamar pedido',
    'nucleo/turnos.ts; vistas/operador/OperadorPage.tsx',
    'Capturar o Anunciar; renovar vigencia sin duplicados.',
    [
      [
        'Repetir actual',
        'Llamar actual de nuevo.',
        'Lista idéntica y nuevo anuncio.',
        'Unit/Selenium',
        'P 0',
      ],
      [
        'Rellamar anterior',
        'Con 42 actual y 98 anterior llamar 98.',
        '98 actual, 42 anterior y sin duplicados.',
        'Unit/Selenium',
        'P 0',
      ],
      [
        'Rellamar desplazado',
        'Llamar número fuera de pantalla.',
        'Entra como nuevo.',
        'Unit/Selenium',
        'P 1',
      ],
    ],
  ],
  [
    'CU-03',
    'Corregir captura',
    'nucleo/turnos.ts; backend/queue-store.ts',
    'Corrección silenciosa de un nivel.',
    [
      [
        'Corregir una vez',
        'Llamar 42 y 98; corregir dos veces.',
        'Restaura 42 sin anunciar; segundo intento no cambia.',
        'Unit/Selenium',
        'P 0',
      ],
      [
        'Corrección y vencimiento/reinicio',
        'Vencer previo o reiniciar; intentar corregir.',
        'No revive vencidos; reinicio pierde deshacer.',
        'Unit/integración',
        'P 1',
      ],
    ],
  ],
  [
    'CU-04',
    'Reproducir multimedia y anuncios',
    'vistas/publica/Contenido.tsx; vistas/publica/useAnuncios.ts; vistas/publica/audio.ts',
    'YouTube de escritorio → videos → imágenes → bienvenida; audio local FIFO.',
    [
      [
        'Audio FIFO y acuse',
        'Llamar varios y observar acuses ID/número.',
        'Orden FIFO y correlación correcta.',
        'Integración/audio',
        'P 0',
      ],
      [
        'Límites temporales audio',
        'Superar 45 s espera/30 s ejecución; quitar pendiente.',
        'Descartar/cancelar sin bloquear siguientes.',
        'Unit/integración',
        'P 1',
      ],
      [
        'Fallo audio y voz cero',
        'Usar voz ausente o volumen 0; llamar.',
        'Turno guardado permanece; error sin falso acuse correcto.',
        'Integración/manual',
        'P 0',
      ],
      [
        'Atenuación multimedia',
        'Llamar durante video.',
        'Video continúa; volumen baja y recupera.',
        'Integración/manual',
        'P 1',
      ],
      [
        'Prioridad y bienvenida',
        'Inventarios vacío, imágenes, videos y YouTube de escritorio.',
        'Prioridad y respaldo correctos.',
        'Integración/Selenium',
        'P 1',
      ],
      [
        'Video termina o falla',
        'Usar 2 videos y provocar error/fin.',
        'Siguiente evita repetir si hay alternativa; turnos siguen.',
        'Integración/manual',
        'P 1',
      ],
    ],
  ],
  [
    'CU-05',
    'Abrir y recuperar jornada',
    'main/main.ts; main/ventanas.ts; main/persistencia.ts; backend/queue-store.ts',
    'Recuperar vigentes del día sin audio viejo ni deshacer; TV o ventana primaria.',
    [
      [
        'Persistir antes de anunciar',
        'Forzar error escritura/espacio; resolver y reintentar.',
        'Fallo no cambia estado ni anuncia; reintento guarda.',
        'Unit/integración',
        'P 0',
      ],
      [
        'Recuperación diaria',
        'Guardar vigente; reiniciar; cambiar día.',
        'Recupera vigentes sin audio/deshacer; nuevo día vacío.',
        'Unit/integración',
        'P 0',
      ],
      [
        'Corrupción y migración legacy',
        'Arrancar con JSON corrupto y datos legacy aislados.',
        'Advertencia/copias; conserva originales legacy.',
        'Unit/integración',
        'P 1',
      ],
      [
        'Pantallas y reconexión',
        'Abrir con 1/2 monitores; desconectar/reconectar TV.',
        'Ventana primaria/fullscreen secundario; captura fuera de TV.',
        'Integración/manual',
        'P 1',
      ],
      [
        'Jornada larga offline',
        'Desconectar internet; simular jornada monitorizada.',
        'Turnos/voz local siguen sin degradación sostenida.',
        'Rendimiento/manual',
        'P 1',
      ],
    ],
  ],
  [
    'CU-06',
    'Administrar contenido/configuración',
    'main/contenido.ts; main/config.ts; vistas/operador/MultimediaPanel.tsx',
    'Importación asíncrona local; voz 0–300%, multimedia 0–100%, repeticiones 1/2.',
    [
      [
        'Volúmenes',
        'Aplicar extremos válidos y enviar fuera de rango por API.',
        'Válidos persisten; inválidos rechazados según contrato.',
        'API/Selenium',
        'P 1',
      ],
      [
        'Repeticiones/configuración inválida',
        'Cargar 1/2 repeticiones y configuración corrupta.',
        'Respeta válidos y recupera inválidos sin bloqueo.',
        'Unit/integración',
        'P 1',
      ],
      [
        'Formatos válidos',
        'Importar MP4/WebM/JPG/JPEG/PNG/WebP.',
        'Inventario se actualiza sin recompilar.',
        'API/integración',
        'P 1',
      ],
      [
        'Límites importación',
        'Superar 2 GB por video/25 MB por imagen/reserva 512 MB y formato inválido.',
        'Rechazo con motivo; sin parcial aceptado.',
        'Unit/integración',
        'P 0',
      ],
      [
        'Duplicados/cancelar/quitar',
        'Importar mismo nombre; cancelar; quitar con confirmación.',
        'Copias numeradas; cancelar conserva; quitar actualiza.',
        'Integración/Selenium',
        'P 1',
      ],
      [
        'YouTube y navegador',
        'Configurar enlace; fallar la red; abrir navegador.',
        'Respaldo local; YouTube no admitido navegador.',
        'Integración/manual',
        'P 1',
      ],
    ],
  ],
  [
    'CU-07',
    'Quitar número',
    'nucleo/turnos.ts; vistas/operador/OperadorPage.tsx',
    'Confirmar eliminación, promover siguiente e invalidar corrección.',
    [
      [
        'Quitar/cancelar',
        'Cancelar y confirmar eliminación de actual o anterior.',
        'Cancelar conserva; eliminar promueve siguiente e invalida deshacer.',
        'Unit/Selenium',
        'P 0',
      ],
      [
        'Confirmaciones por sesión',
        'No volver a mostrar; anunciar/quitar; reiniciar.',
        'Afecta ambas acciones; reinicio restablece confirmación.',
        'Selenium',
        'P 1',
      ],
    ],
  ],
  [
    'CU-08',
    'Ayuda/recorrido/manual',
    'vistas/operador/ayuda/HelpCenter.tsx; vistas/operador/ayuda/GuidedTour.tsx; main/manual-usuario.ts',
    'F1/encabezado abre; Escape cierra y devuelve foco.',
    [
      [
        'Ayuda teclado',
        'Pulsar F1, navegar y Escape.',
        'Abre/cierra y devuelve foco a captura.',
        'Selenium',
        'P 1',
      ],
      [
        'Recorrido/progreso',
        'Avanzar/cerrar recorrido y recargar.',
        'Progreso local por origen según implementación.',
        'Selenium',
        'P 2',
      ],
      [
        'Manual offline',
        'Abrir PDF sin internet; probar una ruta arbitraria.',
        'PDF local válido y rutas arbitrarias denegadas.',
        'Integración/Selenium',
        'P 1',
      ],
    ],
  ],
  [
    'CU-09',
    'Consultar diagnósticos',
    'main/diagnostico.ts; vistas/operador/DiagnosticoPanel.tsx',
    'Desde ayuda, estado de guardado/audio/pantallas/espacio y cola.',
    [
      [
        'Diagnósticos y avisos',
        'Abrir desde ayuda; esperar 10 s; provocar error controlado.',
        'Datos actualizados; detalles fuera de pública.',
        'API/Selenium',
        'P 1',
      ],
    ],
  ],
  [
    'CU-10',
    'Personalizar presentación',
    'vistas/comun/tema.ts; vistas/comun/tamanio.ts; vistas/comun/components/AnimatedBackground.tsx',
    'Azul/Morado; escala 70–130%; persistencia por origen.',
    [
      [
        'Tema/escala',
        'Cambiar tema y 70–130%; recargar.',
        'Persistencia por origen; escritorio y navegador independientes.',
        'Selenium',
        'P 2',
      ],
      [
        'Legibilidad/accesibilidad/reloj',
        'Probar 1080p/1440p/4K, teclado, movimiento reducido y distancia física.',
        '12 h am/pm; sin desbordamiento; movimiento reducido y legibilidad manual.',
        'Selenium/manual',
        'P 1',
      ],
    ],
  ],
  [
    'CU-11',
    'Vistas web locales',
    'main/servidor-web.ts; public/browser-transport.js; vistas/comun/transport.ts',
    'Loopback HTTP/SSE; sin cuentas y roles HTTP separados.',
    [
      [
        'HTTP/SSE y recarga',
        'Abrir 2 vistas; llamar; reconectar/recargar.',
        'Estado e inventario convergen.',
        'API/Selenium',
        'P 0',
      ],
      [
        'Seguridad HTTP',
        'Host/Origin inválido, recorrido de rutas y cuerpos inválidos/excesivos.',
        'Rechazo sin mutación ni fuga.',
        'API/integración',
        'P 0',
      ],
      [
        'Seguridad IPC',
        'Mutar desde pública/remitente no autorizado.',
        'IPC pública restringido; sin exponer administración.',
        'Unit/integración',
        'P 0',
      ],
      [
        'Integración TestLink',
        'Ejecutar COMAL-QA-001; reportar y consultar resultado API.',
        'ID documental/script/TestLink mapeados; build y evidencia reales.',
        'Integración',
        'P 0',
      ],
    ],
  ],
  [
    'CU-12',
    'Respaldar/restaurar/actualizar',
    'scripts/datos.ts; main/respaldo.ts; main/migracion-02.ts',
    'Aplicación cerrada; respaldar configuración/estado/contenido y comprobar restauración.',
    [
      [
        'Respaldo/restauración',
        'Respaldar/restaurar; probar copia de otro día.',
        'Datos válidos; no revive turnos de otro día.',
        'Unit/integración/manual',
        'P 1',
      ],
      [
        'Instalador/actualización',
        'Instalar y actualizar Windows estándar con artefacto identificado.',
        'Versión/archivos/datos según política; evidencia del instalador concreto.',
        'Integración/manual',
        'P 1',
      ],
    ],
  ],
];
let n = 0;
const cases = groups.flatMap(([useCase, , source, , tests]) =>
  tests.map(([title, steps, expected, type, priority]) => ({
    id: `COMAL-QA-${String(++n).padStart(3, '0')}`,
    caseId: `COMAL-QA-${String(n).padStart(3, '0')}`,
    useCase,
    title,
    type,
    priority,
    preconditions: {
      'CU-01':
        'Instancia QA aislada vacía para alta; estado conocido para límites, reloj controlado para vencimiento y cola retenida para saturación.',
      'CU-02':
        'Estado aislado con actual 42, anterior 98 y un número desplazado; capacidad de audio disponible.',
      'CU-03':
        'Llamadas 42 y 98 aceptadas; guardar instantánea anterior y controlar vencimiento o reinicio según escenario.',
      'CU-04':
        'Vista pública activa; fixtures locales válidos y corruptos; audio y tiempos controlados cuando aplique.',
      'CU-05':
        'Carpeta de datos QA aislada; copias vigentes/corruptas preparadas; reloj o monitores físicos según escenario.',
      'CU-06':
        'Directorio multimedia QA aislado, archivos de prueba y configuración conocida; espacio controlable para límites.',
      'CU-07':
        'Actual 42 y anterior 98 presentes; corrección pendiente; confirmaciones activas al iniciar sesión.',
      'CU-08':
        'Operador abierto con foco en captura, perfil de preferencias limpio y PDF del build disponible.',
      'CU-09':
        'Operador abierto y datos de diagnóstico conocidos; error controlado para comprobar avisos.',
      'CU-10':
        'Perfiles QA aislados, resoluciones y preferencia de movimiento reducido configurables.',
      'CU-11':
        'Comal aislado escuchando en loopback; dos vistas abiertas; para integración, API TestLink operativa y credenciales privadas.',
      'CU-12':
        'Aplicación cerrada, respaldo QA disponible y artefacto Windows identificado; nunca usar datos operativos.',
    }[useCase],
    steps: [steps],
    expected,
    source,
    status: 'planned',
    automation:
      n === 1
        ? 'qa/automation (ruta final por agente Selenium)'
        : 'planned; supporting repository tests are not execution evidence',
  })),
);
const out = new URL('./', import.meta.url);
fs.writeFileSync(
  new URL('casos-prueba.json', out),
  JSON.stringify(
    {
      schemaVersion: 1,
      productVersion: '1.0.0',
      scope: 'Fases 1–4; solo smoke de integración; regresión pendiente',
      cases,
    },
    null,
    2,
  ) + '\n',
);
const q = (v) => '"' + String(v).replaceAll('"', '""') + '"';
fs.writeFileSync(
  new URL('matriz-trazabilidad.csv', out),
  '\ufeff' +
    [
      'id, useCase, title, type, priority, status, source, automation',
      ...cases.map((c) =>
        ['id', 'useCase', 'title', 'type', 'priority', 'status', 'source', 'automation']
          .map((k) => q(c[k]))
          .join(','),
      ),
    ].join('\n') +
    '\n',
);
const esc = (v) =>
  String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
fs.writeFileSync(
  new URL('testlink-import.xml', out),
  '<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="Comal++ 1.0.0 QA">\n' +
    cases
      .map(
        (c) =>
          `<testcase name="${esc(c.id + ' ' + c.title)}"><summary>${esc(c.useCase + ' | ' + c.type)}</summary><preconditions>${esc(c.preconditions)}</preconditions><execution_type>${c.id === 'COMAL-QA-001' ? 2 : 1}</execution_type><importance>${c.priority === 'P 0' ? 3 : c.priority === 'P 1' ? 2 : 1}</importance><steps><step><step_number>1</step_number><actions>${esc(c.steps[0])}</actions><expectedresults>${esc(c.expected)}</expectedresults><execution_type>1</execution_type></step></steps></testcase>`,
      )
      .join('\n') +
    '\n</testsuite>\n',
);
const intro =
  '# Casos de uso actualizados — Comal++ 1.0.0\n\nRevisión de diseño: 4 de noviembre de 2026. Basado en package.json, contrato compartido, núcleo, store, servidor y manual vigente. Los documentos originales se conservan. Esta revisión no declara la suite ejecutada.\n\nActores: operador local, sistema, responsable técnico y cliente pasivo. No hay cuentas de negocio, ventas, cobro, entregas/cancelaciones ni historial comercial. Usuarios de TestLink son independientes.\n\n';
const body = groups
  .map(
    ([id, title, source, flow]) =>
      `## ${id} — ${title}\n\nPrecondición: app abierta y datos conocidos; detalles por escenario en catálogo.\n\nFlujo/resultado: ${flow}\n\nAlternativas, negativos y criterios:${cases
        .filter((c) => c.useCase === id)
        .map((c) => c.id)
        .join(', ')}.\n\nFuente: ${source}.\n`,
  )
  .join('\n');
const end =
  '\n## Diferencias frente a las notas históricas\n\n- Captura 1–6 dígitos, últimos 2; 00 válido. Repeticiones predeterminadas 1, configurable 1/2.\n- Corrección implementada y silenciosa; quitar invalida corrección.\n- Vigencia 5 min; reinicio recupera solo vigentes del día, sin audio antiguo ni deshacer.\n- Inicio automático al encender Windows requiere certificación del equipo e instalador; no se promete por leer el requisito histórico.\n- Ayuda, recorrido, PDF, diagnósticos, tema/escala, importación, HTTP/SSE y respaldos tienen casos adicionales.\n\n## Cobertura y estado\n\n 12 casos de uso y 43 escenarios diseñados. JSON y CSV conservan estado planned: son diseño, no evidencia de aprobación. Solo COMAL-QA-001 corresponde al smoke Selenium de integración fase 4; consultar evidencias del adaptador y TestLink para resultado real. La ejecución completa, regresión, audio físico, varios monitores, instalador, jornada y rendimiento quedan pendientes de fases 5/6.\n\nEl XML permite importar casos usando ID documental en el nombre. TestLink asigna su propio ID externo: numérico; conservar un mapa explícito y no asumir que coincide con COMAL-QA-xxx. JSON: objeto cases con id, caseId, useCase, title, type, priority, preconditions, steps, expected, source, status y automation.\n\nEl inventario cubre capacidades expuestas y reglas detectadas; no demuestra todos los caminos internos ni sustituye validación con operadores. Las pruebas existentes son referencias, no resultados ejecutados en esta revisión.\n';
fs.writeFileSync(new URL('casos-de-uso-actualizados.md', out), intro + body + end);
console.log(`${groups.length} casos de uso; ${cases.length} escenarios generados.`);

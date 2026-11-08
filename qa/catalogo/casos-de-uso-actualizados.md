# Casos de uso actualizados — Comal++ 1.0.0

Revisión de diseño: 4 de noviembre de 2026. Basado en package.json, contrato compartido, núcleo, store, servidor y manual vigente. Los documentos originales se conservan. Esta revisión no declara la suite ejecutada.

Actores: operador local, sistema, responsable técnico y cliente pasivo. No hay cuentas de negocio, ventas, cobro, entregas/cancelaciones ni historial comercial. Usuarios de TestLink son independientes.

## CU-01 — Llamar pedido listo

Precondición: app abierta y datos conocidos; detalles por escenario en catálogo.

Flujo/resultado: Captura 1–6 dígitos; últimos 2; guarda antes de anunciar; actual+5 anteriores.

Alternativas, negativos y criterios:COMAL-QA-001, COMAL-QA-002, COMAL-QA-003, COMAL-QA-004, COMAL-QA-005, COMAL-QA-006, COMAL-QA-007.

Fuente: nucleo/turnos.ts; backend/queue-store.ts.

## CU-02 — Rellamar pedido

Precondición: app abierta y datos conocidos; detalles por escenario en catálogo.

Flujo/resultado: Capturar o Anunciar; renovar vigencia sin duplicados.

Alternativas, negativos y criterios:COMAL-QA-008, COMAL-QA-009, COMAL-QA-010.

Fuente: nucleo/turnos.ts; vistas/operador/OperadorPage.tsx.

## CU-03 — Corregir captura

Precondición: app abierta y datos conocidos; detalles por escenario en catálogo.

Flujo/resultado: Corrección silenciosa de un nivel.

Alternativas, negativos y criterios:COMAL-QA-011, COMAL-QA-012.

Fuente: nucleo/turnos.ts; backend/queue-store.ts.

## CU-04 — Reproducir multimedia y anuncios

Precondición: app abierta y datos conocidos; detalles por escenario en catálogo.

Flujo/resultado: YouTube de escritorio → videos → imágenes → bienvenida; audio local FIFO.

Alternativas, negativos y criterios:COMAL-QA-013, COMAL-QA-014, COMAL-QA-015, COMAL-QA-016, COMAL-QA-017, COMAL-QA-018.

Fuente: vistas/publica/Contenido.tsx; vistas/publica/useAnuncios.ts; vistas/publica/audio.ts.

## CU-05 — Abrir y recuperar jornada

Precondición: app abierta y datos conocidos; detalles por escenario en catálogo.

Flujo/resultado: Recuperar vigentes del día sin audio viejo ni deshacer; TV o ventana primaria.

Alternativas, negativos y criterios:COMAL-QA-019, COMAL-QA-020, COMAL-QA-021, COMAL-QA-022, COMAL-QA-023.

Fuente: main/main.ts; main/ventanas.ts; main/persistencia.ts; backend/queue-store.ts.

## CU-06 — Administrar contenido/configuración

Precondición: app abierta y datos conocidos; detalles por escenario en catálogo.

Flujo/resultado: Importación asíncrona local; voz 0–300%, multimedia 0–100%, repeticiones 1/2.

Alternativas, negativos y criterios:COMAL-QA-024, COMAL-QA-025, COMAL-QA-026, COMAL-QA-027, COMAL-QA-028, COMAL-QA-029.

Fuente: main/contenido.ts; main/config.ts; vistas/operador/MultimediaPanel.tsx.

## CU-07 — Quitar número

Precondición: app abierta y datos conocidos; detalles por escenario en catálogo.

Flujo/resultado: Confirmar eliminación, promover siguiente e invalidar corrección.

Alternativas, negativos y criterios:COMAL-QA-030, COMAL-QA-031.

Fuente: nucleo/turnos.ts; vistas/operador/OperadorPage.tsx.

## CU-08 — Ayuda/recorrido/manual

Precondición: app abierta y datos conocidos; detalles por escenario en catálogo.

Flujo/resultado: F1/encabezado abre; Escape cierra y devuelve foco.

Alternativas, negativos y criterios:COMAL-QA-032, COMAL-QA-033, COMAL-QA-034.

Fuente: vistas/operador/ayuda/HelpCenter.tsx; vistas/operador/ayuda/GuidedTour.tsx; main/manual-usuario.ts.

## CU-09 — Consultar diagnósticos

Precondición: app abierta y datos conocidos; detalles por escenario en catálogo.

Flujo/resultado: Desde ayuda, estado de guardado/audio/pantallas/espacio y cola.

Alternativas, negativos y criterios:COMAL-QA-035.

Fuente: main/diagnostico.ts; vistas/operador/DiagnosticoPanel.tsx.

## CU-10 — Personalizar presentación

Precondición: app abierta y datos conocidos; detalles por escenario en catálogo.

Flujo/resultado: Azul/Morado; escala 70–130%; persistencia por origen.

Alternativas, negativos y criterios:COMAL-QA-036, COMAL-QA-037.

Fuente: vistas/comun/tema.ts; vistas/comun/tamanio.ts; vistas/comun/components/AnimatedBackground.tsx.

## CU-11 — Vistas web locales

Precondición: app abierta y datos conocidos; detalles por escenario en catálogo.

Flujo/resultado: Loopback HTTP/SSE; sin cuentas y roles HTTP separados.

Alternativas, negativos y criterios:COMAL-QA-038, COMAL-QA-039, COMAL-QA-040, COMAL-QA-041.

Fuente: main/servidor-web.ts; public/browser-transport.js; vistas/comun/transport.ts.

## CU-12 — Respaldar/restaurar/actualizar

Precondición: app abierta y datos conocidos; detalles por escenario en catálogo.

Flujo/resultado: Aplicación cerrada; respaldar configuración/estado/contenido y comprobar restauración.

Alternativas, negativos y criterios:COMAL-QA-042, COMAL-QA-043.

Fuente: scripts/datos.ts; main/respaldo.ts; main/migracion-02.ts.

## Diferencias frente a las notas históricas

- Captura 1–6 dígitos, últimos 2; 00 válido. Repeticiones predeterminadas 1, configurable 1/2.
- Corrección implementada y silenciosa; quitar invalida corrección.
- Vigencia 5 min; reinicio recupera solo vigentes del día, sin audio antiguo ni deshacer.
- Inicio automático al encender Windows requiere certificación del equipo e instalador; no se promete por leer el requisito histórico.
- Ayuda, recorrido, PDF, diagnósticos, tema/escala, importación, HTTP/SSE y respaldos tienen casos adicionales.

## Cobertura y estado

 12 casos de uso y 43 escenarios diseñados. JSON y CSV conservan estado planned: son diseño, no evidencia de aprobación. Solo COMAL-QA-001 corresponde al smoke Selenium de integración fase 4; consultar evidencias del adaptador y TestLink para resultado real. La ejecución completa, regresión, audio físico, varios monitores, instalador, jornada y rendimiento quedan pendientes de fases 5/6.

El XML permite importar casos usando ID documental en el nombre. TestLink asigna su propio ID externo: numérico; conservar un mapa explícito y no asumir que coincide con COMAL-QA-xxx. JSON: objeto cases con id, caseId, useCase, title, type, priority, preconditions, steps, expected, source, status y automation.

El inventario cubre capacidades expuestas y reglas detectadas; no demuestra todos los caminos internos ni sustituye validación con operadores. Las pruebas existentes son referencias, no resultados ejecutados en esta revisión.

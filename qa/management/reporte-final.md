# Reporte final de validación QA

Para el alcance y la relación entre Selenium y TestLink, consultar
[alcance-y-entregable-final.md](./alcance-y-entregable-final.md).

## Alcance

Fases 1–6 sobre Comal `1.0.0`. La regresión final (fase 6) se ejecutó el
2026-11-08 de 04:35 a 04:45 UTC con `npm run qa:regression` y se registró en TestLink,
build `26` del plan `Integración fase 4`, proyecto `Comal QA integración`.

## Resultado de la regresión final

| Estado  | Casos | Significado                                                                          |
| ------- | ----: | ------------------------------------------------------------------------------------ |
| PASS    |    37 | Todas las comprobaciones automatizadas del caso pasaron                              |
| FAIL    |     0 | —                                                                                    |
| BLOCKED |     9 | Lo automatizado pasó, pero el resultado esperado exige hardware físico o una persona |

- Los 46 resultados se publicaron en TestLink y se confirmaron por lectura
  (`getLastExecutionResult`): `allReadbackConfirmed: true`.
- Los 14 escenarios Selenium adjuntaron su captura en TestLink (`<caso>.png`).
- Detalle por caso, con las comprobaciones de cada uno: [docs/qa/regression-summary.json](../../docs/qa/regression-summary.json).
- Trazabilidad caso → script → TestLink: [matriz-trazabilidad.csv](../catalogo/matriz-trazabilidad.csv).

## Cómo se ejecuta cada caso

`qa/automation/regression-map.mjs` asigna a cada caso las herramientas adecuadas:

- **Unitarias/integración** (`node:test` vía `tsx`, salida JUnit): 65 asignaciones
  archivo + patrón; cada patrón debe coincidir con al menos una prueba.
- **Smoke Electron/Node** existentes (`scripts/smoke-*.mjs`, `validar-recuperacion.mjs`).
- **Selenium UI** (`qa/automation/ui.mjs`): 14 escenarios end-to-end sobre la UI real
  (001, 002, 003, 004, 008, 009, 010, 011, 030, 031, 032, 036, 038, 045). Cada uno prepara
  su propio estado; un fallo no detiene el resto.
- **Integración TestLink** (`qa/automation/integration.mjs`): COMAL-QA-001 y 041.

Un caso con parte manual nunca se reporta PASS: queda BLOCKED, con las notas de lo
automatizado y lo pendiente.

## Casos BLOCKED (pendientes en el equipo físico)

| Caso         | Pendiente                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------- |
| COMAL-QA-007 | Latencia Enter→pantalla/sonido (<1 s) en el hardware identificado                           |
| COMAL-QA-015 | Confirmar de oído que la voz ausente o volumen 0 no suena                                   |
| COMAL-QA-016 | Atenuación y recuperación del video en la TV/altavoces reales                               |
| COMAL-QA-017 | YouTube de escritorio con Internet real                                                     |
| COMAL-QA-022 | 1 y 2 monitores; desconectar/reconectar la TV                                               |
| COMAL-QA-023 | Jornada completa `npm run test:full-day` (6.5 h) sin Internet; solo se ejecutó el preflight |
| COMAL-QA-029 | Pérdida de red real con YouTube de escritorio                                               |
| COMAL-QA-037 | Legibilidad a distancia en la TV física                                                     |
| COMAL-QA-043 | Instalador 1.0.0 identificado (solo existe 0.3.0) + `test:installed`/`test:upgrade`         |

## Incidencias de infraestructura QA resueltas

- **TestLink 6002 al adjuntar capturas UI**: `allowed_filenames_regexp` de TestLink
  limita la base del nombre a 20 caracteres. Las capturas se suben ahora como `<caso>.png`.
  Reproducido y verificado contra la instancia real.
- **Espera inestable en `integration.mjs`**: `driver.wait` abortaba con
  `NoSuchElementError` si la vista pública aún no se había pintado; ahora sigue sondeando.
- **`smoke-help.mjs` inestable**: un fallo aislado `Reload unavailable` en la línea base
  pasó al repetir y en la regresión final. Se recomienda vigilarlo; no se modificó.

## Defectos de producto

Ninguno detectado en la regresión.

## Comandos reproducibles

```powershell
.\qa\testlink\setup.ps1          # levantar TestLink (Docker)
.\qa\testlink\verify.ps1         # login, XML-RPC y bloqueos
node qa/automation/import-catalog.mjs   # registrar/actualizar los 43 casos
npm run qa:regression            # regresión completa + reporte a TestLink
npm run qa:regression -- --no-testlink  # solo ejecución local
```

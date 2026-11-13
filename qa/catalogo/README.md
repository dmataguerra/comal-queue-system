# Catálogo de pruebas de Comal++

Este catálogo corresponde a la versión `1.0.0` declarada en `package.json`, revisada el 4 de noviembre de 2026. Conserva los seis casos de uso originales y agrega seis capacidades implementadas que necesitan cobertura explícita.

| Archivo | Uso |
| --- | --- |
| `casos-de-uso-actualizados.md` | Inventario de capacidades y diferencias respecto de las notas originales. |
| `casos-prueba.json` | Fuente estructurada con 46 escenarios, pasos, resultados esperados, prioridad, técnica de prueba y última ejecución. |
| `matriz-trazabilidad.csv` | Relación entre cada caso de uso, escenario y archivo de implementación. |
| `testlink-import.xml` | Importación manual de los escenarios 001–043 mediante la interfaz de TestLink. Los casos 044–046 se registran con `qa/automation/import-catalog.mjs`. |
| `generar-catalogo.mjs` | Generador de la versión inicial de 43 escenarios. **No volver a ejecutarlo sin incorporar antes los casos 044–046**: sobrescribiría el JSON, la matriz y los resultados registrados. |

La revisión utilizó `docs/casos-de-uso.md`, `docs/user-manual/operador.md`, `shared/contract.ts`, `nucleo/turnos.ts`, `nucleo/cola.ts`, `backend/queue-store.ts`, `main/servidor-web.ts` y el inventario de componentes y pruebas del repositorio. Las rutas específicas de cada capacidad aparecen en el campo `source`.

`COMAL-QA-001` identifica la prueba de integración autorizada en la fase 4: introducir el ticket **42** mediante Selenium y comprobar su aparición en las vistas del operador y pública. El adaptador debe asociar el resultado real con el caso registrado en TestLink y con una ejecución/build identificable. El identificador numérico asignado por TestLink se conserva mediante un mapa; no se deduce del identificador documental.

Los escenarios se diseñaron como `planned` para no confundir pruebas propuestas con ejecuciones reales. Las fases 5 y 6 ya se ejecutaron: la regresión final del 8 de noviembre de 2026 (`npm run qa:regression`, TestLink build 26) registró **37 PASS, 0 FAIL y 9 BLOCKED** sobre los 46 escenarios. Los casos 044–046 se añadieron en esa etapa para cerrar huecos de cobertura automatizada. El detalle está en el [reporte final](../management/reporte-final.md) y en [regression-summary.json](../../docs/qa/regression-summary.json); TestLink y esas evidencias son la fuente del resultado, no el campo de diseño.

No existe una matriz de cuentas y roles de negocio en Comal: la pública de Electron tiene restricciones IPC, mientras que el servidor HTTP está limitado a la misma computadora y no crea usuarios independientes. Por eso se proponen pruebas de autorización por transporte y origen, en lugar de inventar cuentas de administrador u operador.

La percepción de audio en bocinas, la legibilidad desde la cafetería, la conexión física de monitores y el comportamiento de un instalador concreto requieren comprobaciones adicionales en el equipo objetivo. Un navegador automatizado no acredita esas propiedades.

# Catálogo de pruebas de Comal++

Este catálogo corresponde a la versión `1.0.0` declarada en `package.json`, revisada el 4 de noviembre de 2026. Conserva los seis casos de uso originales y agrega seis capacidades implementadas que necesitan cobertura explícita.

| Archivo | Uso |
| --- | --- |
| `casos-de-uso-actualizados.md` | Inventario de capacidades y diferencias respecto de las notas originales. |
| `casos-prueba.json` | Fuente estructurada con 43 escenarios, pasos, resultados esperados, prioridad y técnica de prueba. |
| `matriz-trazabilidad.csv` | Relación entre cada caso de uso, escenario y archivo de implementación. |
| `testlink-import.xml` | Importación de los escenarios mediante la interfaz de TestLink. |
| `generar-catalogo.mjs` | Generador reproducible de los cuatro artefactos anteriores. |

La revisión utilizó `docs/casos-de-uso.md`, `docs/user-manual/operador.md`, `shared/contract.ts`, `nucleo/turnos.ts`, `nucleo/cola.ts`, `backend/queue-store.ts`, `main/servidor-web.ts` y el inventario de componentes y pruebas del repositorio. Las rutas específicas de cada capacidad aparecen en el campo `source`.

`COMAL-QA-001` identifica la prueba de integración autorizada en la fase 4: introducir el ticket **42** mediante Selenium y comprobar su aparición en las vistas del operador y pública. El adaptador debe asociar el resultado real con el caso registrado en TestLink y con una ejecución/build identificable. El identificador numérico asignado por TestLink se conserva mediante un mapa; no se deduce del identificador documental.

Todos los escenarios del catálogo empiezan como `planned`. Esto describe el diseño y evita confundir pruebas propuestas con ejecuciones reales. Las evidencias generadas por el framework y el registro de TestLink son las fuentes para conocer el resultado de la integración. El resto de la ejecución, regresión y validación final pertenece a las fases 5 y 6, fuera del alcance solicitado ahora.

No existe una matriz de cuentas y roles de negocio en Comal: la pública de Electron tiene restricciones IPC, mientras que el servidor HTTP está limitado a la misma computadora y no crea usuarios independientes. Por eso se proponen pruebas de autorización por transporte y origen, en lugar de inventar cuentas de administrador u operador.

La percepción de audio en bocinas, la legibilidad desde la cafetería, la conexión física de monitores y el comportamiento de un instalador concreto requieren comprobaciones adicionales en el equipo objetivo. Un navegador automatizado no acredita esas propiedades.

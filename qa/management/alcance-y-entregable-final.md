# Alcance de QA con Selenium y TestLink

## 1. Objetivo

El objetivo de esta implementación es convertir las pruebas de Comal Queue
System en un proceso repetible y trazable:

```text
Caso de uso → caso de prueba → Selenium/otra herramienta → resultado → TestLink → evidencia
```

Selenium automatiza la interacción con la interfaz web local de Comal. TestLink
organiza el catálogo, relaciona los casos con una versión y un plan de pruebas,
registra PASS/FAIL y conserva las evidencias. No sustituyen las pruebas
unitarias existentes ni validan por sí solos hardware físico.

## 2. Qué se puede conseguir

### Con Selenium

- Ejecutar flujos reales de operador y pantalla pública en Chrome headless.
- Repetir pruebas sin depender de interacción manual.
- Validar entradas, navegación, sincronización entre ventanas y estados visibles.
- Capturar screenshots cuando una prueba pasa o falla.
- Ejecutar contra una instancia aislada de Comal, sin modificar los datos
  habituales del usuario.
- Integrar la suite en CI cuando el equipo disponga de Chrome y Electron.

### Con TestLink

- Mantener un catálogo central de casos, prioridades, precondiciones, pasos y
  resultados esperados.
- Agrupar los casos por proyecto, plan y build.
- Relacionar el identificador documental `COMAL-QA-xxx` con el identificador
  que TestLink asigna a cada versión.
- Registrar resultados automatizados y distinguirlos de casos todavía
  planificados.
- Adjuntar capturas y notas técnicas como evidencia auditable.
- Conservar resultados y adjuntos mediante Docker/MySQL y volúmenes persistentes.
- Obtener reportes de cobertura y regresión cuando se ejecute el catálogo.

### Resultado combinado

La integración permite demostrar que un cambio en Comal puede pasar por un
flujo verificable de calidad, desde la acción en pantalla hasta el registro
auditable en TestLink. También permite detectar fallos del adaptador: se ejecutó
un control negativo deliberado y TestLink conservó correctamente el estado
`FAIL`.

## 3. Alcance funcional de Comal

El catálogo actualizado contiene 12 casos de uso y 46 escenarios (43 iniciales más 044–046):

| Área                       | Casos de uso         | Cobertura prevista                                                     |
| -------------------------- | -------------------- | ---------------------------------------------------------------------- |
| Operación de turnos        | CU-01 a CU-03, CU-07 | Captura, rellamada, corrección, eliminación, límites y duplicados      |
| Multimedia y configuración | CU-04, CU-06, CU-10  | Reproducción, audio, importación, volumen, repeticiones, tema y escala |
| Jornada y recuperación     | CU-05, CU-12         | Persistencia, recuperación, respaldo, restauración y migración         |
| Ayuda y diagnóstico        | CU-08, CU-09         | Ayuda, recorrido, manual y diagnóstico                                 |
| Transporte web local       | CU-11                | HTTP/SSE loopback, vistas pública/operador y restricciones de origen   |

El catálogo se encuentra en [casos-prueba.json](../catalogo/casos-prueba.json),
la relación entre funcionalidades y escenarios en
[matriz-trazabilidad.csv](../catalogo/matriz-trazabilidad.csv), y los casos de
uso en [casos-de-uso-actualizados.md](../catalogo/casos-de-uso-actualizados.md).

## 4. Qué está realmente probado

La siguiente evidencia es de ejecución real, no una proyección:

| Identificador       | Prueba                                                                  | Resultado                            |
| ------------------- | ----------------------------------------------------------------------- | ------------------------------------ |
| `COMAL-QA-001`      | Selenium introduce `42` en operador y verifica `42` en pantalla pública | PASS                                 |
| `COMAL-QA-003`      | Selenium rechaza una captura inválida sin mutar el estado               | PASS                                 |
| `COMAL-QA-011`      | Selenium corrige la última captura sin anunciarla                       | PASS                                 |
| `INFRA-ADAPTER-001` | Control negativo: reportar `FAIL` y leerlo de TestLink                  | PASS como control de infraestructura |
| Infraestructura     | Login, XML-RPC, bloqueo de `/install` y `/docs`                         | PASS                                 |
| Persistencia        | Recreación de contenedores sin borrar volúmenes                         | PASS                                 |

La suite UI creó una build y tres ejecuciones en TestLink, y leyó cada
resultado `PASS` mediante XML-RPC. Las capturas se conservan localmente en
`test-results/qa-ui/evidence/`; TestLink registra las notas y resultados. Los
otros 40 escenarios del catálogo permanecen `planned`; no deben presentarse
como aprobados hasta ejecutarlos.

## 5. Fuera de alcance de Selenium/TestLink

- Calidad física del audio en bocinas.
- Legibilidad desde la cafetería, conexión de TV y varios monitores.
- Rendimiento prolongado de una jornada completa.
- Instalación, inicio automático de Windows y firma del instalador.
- Pruebas unitarias internas: permanecen en la suite de Node/TypeScript.
- Usuarios, roles de negocio o permisos de ventas que Comal no implementa.

Estas áreas requieren pruebas de hardware, instalación, rendimiento o revisión
manual. TestLink puede documentarlas, pero Selenium no puede certificar por sí
solo su resultado.

## 6. Entregable final esperado

El paquete final de QA debe contener:

1. Casos de uso actualizados y contrastados con el código.
2. Catálogo estructurado de los 46 escenarios.
3. Matriz de trazabilidad entre caso de uso, escenario, fuente y automatización.
4. Docker Compose reproducible para TestLink y MySQL persistente.
5. Framework Selenium y adaptador XML-RPC.
6. Casos importados en TestLink con sus identificadores.
7. Resultados, notas y capturas de las ejecuciones reales.
8. Reporte de cobertura, aprobados, fallidos, limitaciones y pendientes.

El estado y la evidencia actual están resumidos en
[reporte-final.md](./reporte-final.md).

## 7. Procedimiento reproducible

Desde la raíz del repositorio:

```powershell
.\qa\testlink\setup.ps1
.\qa\testlink\verify.ps1
npm run qa:integration
npm run qa:ui
node qa\automation\import-catalog.mjs
npm run qa:regression
```

`setup.ps1` genera credenciales locales si no existen y no las incorpora al
repositorio. `qa:integration` construye Comal, inicia una instancia aislada,
ejecuta Selenium headless y registra el smoke de integración en TestLink.
`qa:ui` construye Comal, ejecuta la suite UI, guarda capturas en
`test-results/qa-ui/evidence/` y registra resultados y adjuntos en TestLink.
La importación del catálogo registra los casos como diseñados; no inventa
ejecuciones. `qa:regression` ejecuta los 46 escenarios según
`qa/automation/regression-map.mjs` y publica cada resultado en TestLink; con
`-- --no-testlink` solo ejecuta localmente.

## 8. Criterio de terminado

La integración de infraestructura se considera terminada cuando:

- TestLink es accesible y autenticado.
- Docker conserva esquema, casos, resultados y adjuntos al recrear contenedores.
- Selenium ejecuta al menos un flujo real de Comal.
- El resultado se lee desde TestLink y la evidencia se adjunta correctamente.
- Existe trazabilidad entre documentación, script e identificador TestLink.
- Los casos no ejecutados están marcados como `planned`.

La regresión completa se considera terminada después de ejecutar los escenarios
aplicables, analizar sus fallos y publicar el reporte final de cobertura. Ese
criterio se cumplió el 8 de noviembre de 2026 para la parte automatizable: 46
escenarios, 37 PASS, 0 FAIL y 9 BLOCKED. Los nueve casos BLOCKED exigen el
equipo físico o una persona y siguen pendientes. Esta separación evita
confundir la disponibilidad de la herramienta con la calidad ya demostrada del
producto.

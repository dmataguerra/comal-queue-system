# Prueba de jornada real

Ejecutar desde la carpeta del proyecto:

```powershell
npm run test:full-day
```

La compilación y el arranque preceden a **390 minutos reales** de operación.
El test copia el contenido de fábrica directamente a su carpeta aislada antes
de abrir las ventanas, y exige aviso, 100 voces y precarga correcta. Esto evita
depender del renombrado de carpeta del primer arranque; no valida ese mecanismo
de instalación de la aplicación.

Para comprobar primero el arranque, ocho anuncios confirmados, saturación sin mutación, entradas inválidas, corrección y recarga de la pantalla pública sin repetición de audio antiguo:

```powershell
npm run test:full-day -- --preflight
```

Este modo termina con PREFLIGHT_PASS, nunca con PASS de jornada completa.
No acelera relojes ni sustituye el ensayo de 390 minutos.

La prueba empieza en el momento de ejecutarla; las etiquetas 08:30–15:00
describen las franjas de carga y no modifican la hora del equipo.
No se acelera Date.now, el audio ni los temporizadores.

Se abren las ventanas de operador y pública y se reproduce audio real.
Mantener el equipo conectado a corriente y no cerrar las ventanas ni usar
manualmente esta instancia. Se solicita a Windows mantener la pantalla activa.
Una suspensión detectada invalida la jornada. Un cierre forzado puede dejar
el último informe con estado RUNNING; eso nunca equivale a PASS.

Cada ejecución usa una carpeta nueva dentro de test-results/full-day-*.
La configuración y el estado de prueba quedan aislados. El inventario disponible
se registra en el informe: si no hay videos, no se puede concluir estabilidad
de reproducción de video. La prueba usa la API de la vista del operador;
no verifica captura física por teclado ni que las bocinas sean audibles.

## Comprobaciones

- Carga determinista por franjas, ráfagas de seis llamados y rellamadas.
- Entradas inválidas sin cambio de estado y restauración al deshacer; se esperan los acuses pendientes antes de corregir o recargar.
- Expiración automática después de seis minutos sin llamados.
- Números únicos, válidos y un máximo de seis visibles; coincidencia entre TV, memoria y `estado.json`. Historial de entregas acotado a 100 y cola de audio a seis.
- Confirmación de cada anuncio desde la vista pública, con identificador y número.
  Un fallo o más de 120 segundos sin confirmación detiene la prueba.
- Recuperación de la sonda tras recarga, sin repetir anuncios viejos, y llamada nueva tras recuperar la vista a mitad de la jornada real.
- Fuentes de audio sin superposición y todas terminadas al cierre.
- Diagnóstico de persistencia, salud de audio y detección de procesos caídos.
- Respuesta de las vistas con límite de 15 segundos por consulta.

## Evidencia

La consola informa progreso cada minuto. Los archivos se actualizan durante
la jornada y también cuando una aserción falla:

- jornada-completa.json: estado RUNNING/PASS/FAIL, duración real, entorno,
  métricas, latencias de despacho, resultados por franja y limitaciones.
- metricas.csv: muestras periódicas de CPU, memoria, procesos y tamaño de logs.
- acciones.jsonl: despachos y acuses de audio con fecha real.

La CPU usa percentCPUUsage de Electron, sumada entre procesos.
La temperatura es opcional y se omite después del primer error de acceso.
La latencia de despacho mide la respuesta de la API, no el tiempo hasta
oír el anuncio. Los promedios de ocupación por franja se calculan sobre
acciones, no como ocupación ponderada por tiempo.

PASS exige completar los 390 minutos y todas las comprobaciones.
El ensayo no impone un umbral arbitrario de memoria: los datos permiten
comparar crecimiento entre ejecuciones en el mismo equipo.

## Aislamiento y reintentos

El script usa `TURNERO_PUERTO='0'` para no ocupar el 4317 de otra aplicación abierta. Cada llamada rechazada por capacidad reintenta dentro de un máximo de 120 segundos; el informe registra `capacityRetries`. Se esperan todos los acuses antes de correcciones, recargas y cierre. Los checkpoints utilizan el renombrado con reintentos de Windows; si falla guardar la evidencia de un error, el informe se conserva también en la salida. La sonda distingue épocas de recarga y cambios del número de anuncio.

La revisión paralela del 1 de octubre obtuvo **PREFLIGHT_PASS con ocho anuncios** en `test-results/full-day-fgFKKb/jornada-completa.json`. Es evidencia local de esa revisión, no de 390 minutos ni de un nuevo instalador. Véase [el registro documental](actualizacion-documentacion-2026-10-01.md).

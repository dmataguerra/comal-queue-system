# Jornada completa aprobada — 2 de octubre de 2026

La ejecución local terminó **PASS** después de **390.00049 minutos reales (6 h 30 min)**, de 00:43:43 a 07:13:43, hora de México. Las franjas 08:30–15:00 son etiquetas de carga.

La evidencia original está en la carpeta del checkout de origen: C:/Projects/comal-queue-system/test-results/full-day-oQXbUN/. Se revisaron jornada-completa.json, acciones.jsonl, metricas.csv, turnero.log, config.json, estado.json y los criterios de scripts/smoke-full-day.mjs. Este resultado no acredita una ejecución en la rama documental, un instalador firmado ni el workflow remoto. El informe no registra un commit/hash del binario ensayado.

| Comprobación | Resultado verificado |
| --- | --- |
| Despachos | 138: 124 anuncios, 7 capturas inválidas rechazadas y 7 deshacer sin anuncio |
| Audio | 124 IDs únicos; 248 acuses de inicio/fin con número correcto, sin fallos ni descartes |
| Reglas | 7 rellamadas, 7 correcciones, 7 expiraciones y 3 ráfagas de seis |
| Integridad | 422 comprobaciones correctas; máximo seis visibles, sin duplicados; TV, memoria y archivo coincidentes |
| Recuperación | Recarga automática a las 04:00 y deliberada a las 04:08:38; anuncios posteriores correctos; la deliberada verificó ausencia de repetición |
| Fuentes de audio | Máximo una simultánea; cero activas al cierre |
| Recursos | 395 muestras; seis procesos; CPU media 3.96 %, máxima 8.54 % |
| Memoria total | Media 895 MiB, máxima 1,118 MiB, última muestra 882 MiB; sin crecimiento sostenido |
| Despacho | Media 8.3 ms, p95 11 ms, máximo 80 ms; no mide tiempo hasta oír el audio |
| Registro | 376 líneas, cero errores, una advertencia de arranque «Audio recuperado»; 76,827 bytes, sin rotaciones |
| Cierre | Cola vacía; persistencia/audio correctos, sin errores de aplicación ni acciones pendientes; ninguna caída, cierre o suspensión detectada |

Los 138 despachos del informe coinciden con acciones.jsonl; el CSV contiene 395 muestras. No hubo reintentos por capacidad. En ráfagas, la espera hasta el acuse de inicio llegó aproximadamente a 30 segundos por reproducción secuencial. El acuse final incluye la presentación mínima de la tarjeta y no mide exclusivamente duración audible.

## Alcance y aceptación pendiente

Carga sintética, 100 voces, 42 banners, cero videos locales y YouTube inactivo. No se validaron video prolongado, servicios externos ni atenuación con video. Temperatura no disponible por acceso WMI denegado. El ensayo usa la API del operador, voz al 5 %, contenido preparado directamente y ventanas sin limitación de actividad en segundo plano; no verifica teclado físico, bocinas/HDMI, instalación inicial ni reinicio completo. Las sondas se reinician al recargar y no conservan toda la historia previa a la recarga automática; los acuses individuales respaldan los 124 anuncios.

La resistencia local de turnos, audio y persistencia está aprobada para esta configuración. Siguen pendientes la aceptación del hardware destino, identificación/validación del candidato final, firma y condiciones de publicación.

SHA-256 del informe original: cd16b6f2bbe7106bd5d19d49c7e77c12e28bd2c85f9dfea470ae93c42e9f6404.

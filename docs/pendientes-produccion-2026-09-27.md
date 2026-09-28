# Pendientes de producción y recomendaciones

Revisión del 27-09-2026. Alcance: interfaz del operador, ayuda, audio/cola,
multimedia, transporte navegador, persistencia/importación, ventanas, registro,
CI y firma. Es una revisión dirigida, no una garantía de ausencia de defectos
en cada línea ni una certificación «10/10». Los riesgos se distinguen de fallos
reproducidos. No se implementan aquí cambios de arquitectura.

## Cambios terminados

- [x] Monitor SVG pixel art junto a En pantalla, reutilizando Icon/monitor.
- [x] Panel En pantalla abarca las filas de captura y corrección en escritorio;
  se conserva el apilado en pantallas pequeñas.
- [x] Ayuda ampliada: volumen, estados de audio, multimedia, prioridades,
  tema, escala, confirmaciones, errores de guardado y recuperación.
- [x] Eliminada afirmación de una previsualización numérica que no existía.
- [x] Limpieza del temporizador de notificaciones al desmontar el operador.
- [x] Compilación y catálogo de 100 voces más aviso correctos; 94 pruebas pasan
  fuera del aislamiento. El ENOMEM de tsx se reprodujo solo en ejecución restringida.
- [x] ESLint correcto. Smoke de interfaz correcto fuera del aislamiento: alturas
  alineadas e icono monitor en ventanas de 1366x900 y 900x650, escalas 90/100/110,
  confirmaciones y sincronización. Capturas en test-results/ui-turnos-1366.png
  y test-results/ui-turnos-900.png. Esto no sustituye el smoke del instalador.

## P0 — condiciones para autorizar la entrega

- [ ] **Firma**: resolver identidad pública/proveedor; firmar aplicación,
  desinstalador y Setup, validar cadena, firmante y timestamp. Ver
  revision-firmas-2026-09-27.md. Los archivos existentes siguen sin firma.
- [ ] **Artefacto final**: se reconstruyó el Setup 0.3.1 con los cambios actuales.
  SHA-256: `936EBA7D47FFC781D75C9E055C7012F42B7B190EDAEFBF628FD25E1596CCED94`;
  tamaño `138,886,923` bytes. La firma es `NotSigned`. Falta conservar evidencia
  de `test:installed` sobre este mismo binario después de firmarlo.
- [ ] **Instalación real**: probar instalación limpia, actualización, reversión y
  arranque con cuenta estándar. Repetir el fallo GPU del smoke instalado fuera
  del aislamiento y en destino antes de atribuirlo exclusivamente al entorno.
- [ ] **Audio/ducking**: instrumentar volumen y momento de inicio del timbre y voz
  para videos locales y YouTube; probar primera carga, cambio de video, desconexión,
  llamadas seguidas y cambios de volumen. Una compilación exitosa no acredita que
  el defecto anterior quedó resuelto.
- [ ] **Navegador con YouTube**: public/browser-transport.js devuelve 0 desde
  ajustarVolumenYouTube; useAnuncios espera confirmación antes de reproducir.
  Implementar control compatible y prueba integral o declarar ese modo no admitido.
  El adaptador tampoco emite acuses ni salud; no equipararlo a Electron.
- [ ] **Aceptación en cafetería**: TV extendida, HDMI/bocinas, voz 00/40/99,
  visibilidad desde distancia real, red ausente y reconexión de pantalla.
- [ ] **Resistencia**: completar jornada prolongada con métricas y acuses; guardar
  resultado final, memoria/CPU, cola y fallos. La existencia de smoke-full-day no
  demuestra que una jornada haya pasado.

## P1 — estabilidad y rendimiento

Avance posterior de esta sesión:

- [x] Audio: descarga con timeout, espera limitada/cancelable de carga y resume,
  watchdog de reproducción según duración + 5 segundos. Cancelar, fallar al iniciar
  o no recibir onended libera nodos/listeners y resuelve o rechaza sin retener cola.
  Se añadieron seis casos al comando npm test; total actual: 103 pruebas pasan.
- [x] Instalador anterior A4F9ED4381A1943644033F29742451F020DA647B57FE3B65C170589417454BCF:
  smoke-installed completo correcto fuera del aislamiento. Evidencia:
  test-results/installed-3BBxJG/resultado.json. No valida cambios posteriores ni
  la PC destino; el Setup sigue sin firma y debe reconstruirse.
- [ ] Instalador actual 0.3.1: la reconstrucción terminó correctamente con el
  hash indicado arriba. `test:installed` fue solicitado sobre este archivo, pero
  la revisión automática de permisos agotó los créditos de la sesión y bloqueó
  la ejecución elevada; la ejecución restringida no terminó antes del límite.
  No marcar como instalado y recuperado hasta repetirlo con evidencia.

- [x] Corregida la carrera identificada de YouTube: el identificador se asigna
  antes de esperar al video; una petición reemplazada no modifica volumen.
  La reaplicación periódica se programa después de terminar la petición previa.
  Tres pruebas de regresión pasan (solicitud obsoleta, fin de rampa y video ausente).
  Falta aceptación audible con YouTube real y transiciones de playlist.
- [x] Clima: timeout de 10 segundos, cancelación al desmontar, rechazo de números
  no finitos y conservación de la última lectura válida.
- [x] Smoke instalado: plazos para descubrimiento, conexión y evaluación DevTools;
  desconexión/error rechazan pendientes para permitir registrar el fallo.
  Falta repetir el smoke completo del nuevo instalador.
- [x] CI también contempla push a main, master y codex/** y ejecución manual.
  Su ejecución remota y protección de ramas siguen pendientes; cambios locales.
- [x] Auditoría npm ejecutada: cero vulnerabilidades reportadas en esta consulta.
  Compilación, ESLint de archivos modificados y 94 pruebas existentes correctos;
  las tres pruebas nuevas de volumen también pasan.

Los puntos originales siguientes conservan el contexto y sus verificaciones
operativas pendientes; las correcciones indicadas arriba ya están implementadas.

  desde el inicio, cancelar/rechazar obsoletas y confirmar únicamente la vigente.
- [ ] **Cola sin límite**: nucleo/cola.ts acepta pendientes ilimitados. Definir
  límite y aviso al operador sin descartar pedidos silenciosamente; medir ráfagas.
- [ ] **Espera entre anuncios**: useAnuncios mantiene mínimo 6 s por tarjeta antes
  del siguiente elemento, incluso si la voz terminó. Medir latencia acumulada y
  decidir si separar duración visual de cadencia sonora, preservando orden.
- [ ] **Audio bloqueado**: poner plazos y cancelación efectivos en carga/resume/
  reproducción. Actualmente el flujo espera promesas/eventos sin un plazo global.
  Verificar recuperación de la cola ante falta de onended o dispositivo suspendido.
- [ ] **Acuses perdidos**: main/main.ts guarda entregas por número y solo acepta el
  último id. Repetir el mismo número reemplaza seguimiento del anterior; cerrar la
  pública pierde su cola. Definir expiración de pendientes y recuperación visible.
- [ ] **Importación pesada**: main/contenido.ts usa copyFileSync y exploración
  síncrona. Medir bloqueo al importar videos grandes; trasladar copia a operación
  asíncrona/worker con progreso, preservando publicación atómica.
- [ ] **Precarga de voces**: audio.ts decodifica todo con Promise.all. Medir tiempo
  y pico de memoria; si son altos, limitar concurrencia/priorizar aviso y voces
  próximas. No eliminar precarga sin medir latencia de primera llamada.
- [ ] **Miniaturas**: MultimediaPanel monta un video preload=metadata por archivo.
  Evaluar carga diferida al entrar al área visible con bibliotecas grandes.
- [ ] **Clima**: useClima hace fetch sin abortar por tiempo; añadir cancelación al
  desmontar y timeout, mantener última lectura válida y probar red intermitente.
- [ ] **Clientes web lentos**: servidor-web publica SSE sin gestionar retorno false
  de write. Acotar buffers/conexiones y probar cliente detenido antes de ampliar uso.
- [ ] **Registro**: log.ts hace stat y append síncronos. Medir impacto y, si es
  significativo, usar escritura en cola acotada con vaciado al cerrar y rotación.
- [ ] **Guardado y recuperación**: repetir disco lleno, permisos revocados, JSON
  corrupto y apagado abrupto sobre datos aislados. Mantener rechazo de acciones
  cuando no se guardan; nunca sacrificar durabilidad por velocidad sin acuerdo.

## P1 — calidad de publicación y operación

- [ ] CI: .github/workflows/ci.yml solo corre push para
  copilot/comal-interactive-mockup; definir ramas actuales de entrega y protegerlas.
- [ ] Hacer obligatorias pruebas de audio, interfaz, navegador e instalación según
  modos soportados, además del smoke de escritorio existente.
- [ ] Endurecer smoke-installed: la conexión/evaluación WebSocket puede quedar
  pendiente si se cierra el proceso; añadir timeout y rechazo al cerrar/error,
  garantizando informe y limpieza. El fallo anterior terminó con await sin resolver.
- [ ] Ejecutar auditoría de dependencias actual y revisar resultados; fijar revisión
  de herramientas CI y conservar SBOM/licencias del paquete de entrega.
- [ ] Revisar permisos de distribución de voces, imágenes, logos y fuentes. MIT
  para código propio no demuestra autorización de todos los recursos.
- [ ] Probar acceso por teclado, Escape/F1, foco de modales, contraste y lectura
  con escalas 90/100/110; ayuda larga debe ser desplazable sin perder el cierre.
- [ ] Actualizar manuales históricos: docs/user-manual/source/build_user_manuals.py
  todavía describe flujo antiguo y audio público incompleto. Regenerar manuales
  y capturas después de aceptar la interfaz final.
- [ ] Definir respaldo y restauración probados, responsable de soporte, carpeta
  de evidencias, versión de retorno y procedimiento de actualización fuera de servicio.
- [ ] Revisar política de privacidad: la ayuda cubre operación principal, pero no
  sustituye documentación de conexiones externas (YouTube y clima) ni mantenimiento.

## Mejoras recomendadas después de cerrar bloqueos

1. Botón de prueba de sonido/TV antes de abrir, con confirmación del operador.
2. Indicador de cantidad de anuncios pendientes y tiempo aproximado de espera.
3. Exportar diagnóstico y respaldar desde la interfaz, con confirmación de resultado.
4. Modo de operación solo local para una jornada sin depender de YouTube.
5. Mostrar versión instalada y última copia de respaldo en Diagnósticos.
6. Consolidar CSS: admin.css contiene sucesivas sobreescrituras de los mismos
   paneles; ordenar por componente tras conservar capturas de referencia.
7. Medir percentiles de tiempo hasta voz y despacho, memoria tras una jornada y
   tiempo de importación. Fijar presupuestos a partir de la PC de destino.

Prioridad para los dos días: firma y artefacto trazable, audio real, instalación y
recuperación, jornada de prueba y manual operativo. Las mejoras de comodidad no
deben desplazar esas verificaciones.

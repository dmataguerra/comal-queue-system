# Actualización integral de documentación · 1 de octubre de 2026

## Base y coordinación

- Rama documental: `codex/documentacion-integral`, checkout aislado `.worktrees/documentacion`.
- Versión: `0.3.1`. Base local y remota `codex/production-readiness`: `f0d842a7ec8e74fa10f2b52a2f37532fe910933f`, comprobada mediante fetch.
- La sesión **Probar Comal++ hasta romperlo** confirmó un estado estable de **13 archivos sin commit** de código y pruebas. Se copiaron únicamente esos archivos al checkout documental, sin cambiar su rama, sus archivos ni sus datos.
- Snapshot integrado en commit `d861e5f`: interfaz, puerto de pruebas y validaciones. La copia no representa un commit existente en la rama de origen. El commit documental posterior debe revisarse junto con esta base o aplicarse sobre una implementación equivalente.

## Documentos reconciliados

Se reescribieron los **57 capítulos técnicos** y los metadatos del master/índice LaTeX, sustituyendo la arquitectura 0.2.0 por Electron, React, núcleo puro, store único, JSON atómico, IPC validado y HTTP/SSE loopback. Se actualizaron API/rutas/errores, contratos, configuración y variables, seguridad, requisitos/trazabilidad, UX, pruebas, operación, migración, recuperación y publicación.

Se actualizaron README, instalación USB, arquitectura vigente, anuncios/importación, escala de pantalla, operador, multimedia, CI/CD, firma y lista de publicación. Se contrastaron también documentación de audio y colecciones de iconos con su uso actual. Las atribuciones de terceros se conservan; la actualización no acredita derechos de recursos o aprobación de un proveedor de firma.

Auditorías, planes SQA, pendientes, firmas y publicaciones fechadas mantienen sus resultados/hash originales con aviso de evidencia histórica. Los casos de uso conservan las notas de reunión con una tabla vigente que resuelve discrepancias. Las capturas de la interfaz anterior se identifican como históricas y no se incluyen como instrucciones de la interfaz actual.

Se regeneraron **Manual de Usuario**, **Guía Rápida de Caja** y **Technical Documentation**. El manual de usuario se genera desde `operador.md`; la guía breve se mantiene junto a su generador. El PDF técnico se exporta desde los mismos capítulos LaTeX mediante ReportLab. Se retiraron auxiliares TeX de septiembre para no presentarlos como evidencia actual y se ignoran futuros temporales.

## Últimos cambios incluidos

- Ayuda en encabezado/F1, sin entrada redundante en sidebar; Diagnósticos al final y Escape para cerrar.
- Tamaños 70/80/90/100/110/120/130%, preferencias por origen y diferencia Electron/HTTP.
- Reloj compartido de 12 horas con am/pm; `recargaDiaria` sigue en HH:MM de 24 horas.
- Selector Azul/Morado con ancho reservado; ondas de movimiento sutil, ciclos 24–31.8 s con 33 muestras sinusoidales y movimiento reducido estático.
- Avisos agrupados en `details`; error de cola llena corto, sin envoltorio IPC, conservando ticket y estado.
- `TURNERO_PUERTO='0'` solicita un puerto loopback libre para pruebas. El smoke navegador lee el origen en su propio log y comprueba su carpeta de datos, evitando usar otra instancia en 4317.
- Jornada: reintentos por capacidad con límite de 120 s, espera de acuses antes de correcciones/recargas/cierre, comparación TV/memoria/JSON, sonda por épocas, límites de cola/historial, recuperación a mitad de jornada y checkpoint con reintentos Windows.

## Evidencia de implementación comunicada por la otra sesión

La sesión de implementación confirmó PASS de build, formato, ESLint, smoke-hardening, smoke-interface, smoke-theme, smoke-background, smoke-browser, smoke-destructive-regressions y `main/servidor-web.test.ts`. Las pruebas cubrieron rechazo UI sin prefijo técnico, siete tamaños en dos resoluciones, am/pm, geometría de tema y continuidad/movimiento reducido.

Su último preflight terminó **PREFLIGHT_PASS con ocho anuncios** y comprobó saturación sin mutación, inválidos, corrección y recarga sin repetición. Evidencia local en el checkout de origen: `test-results/full-day-fgFKKb/jornada-completa.json`. La lectura térmica WMI no estuvo disponible y quedó registrada. Estos resultados se atribuyen a esa sesión; no se presentan como una repetición local de toda la suite documental.

**No se ejecutaron 390 minutos reales ni se reconstruyó un instalador con estos cambios.** No se declara aceptación de hardware, firma pública, protecciones remotas o derechos de recursos.

## Validación documental

La comprobación de fuentes incluye objetivos `input`, delimitadores TeX, enlaces locales de Markdown, scripts npm citados, rutas HTTP y límites/configuración frente al código integrado; verifica también que los 13 archivos coinciden byte a byte con el snapshot estable de origen.

Se regeneraron los tres PDF y se revisaron todas sus páginas renderizadas: manual de usuario de cuatro páginas, guía rápida de una página y técnico de 23 páginas. Las comprobaciones de extracción verifican secciones y términos actuales, evitando entregar solo encabezados o fuentes antiguas. Resultados detallados quedan en `test-results/docs-validation/resultado.json` del checkout documental.

El PDF técnico fue generado con **ReportLab**, no con un compilador TeX. La compilación LaTeX actual **no está verificada**: no hay compilador disponible en el entorno de esta sesión. El master multiparchivo y su clase siguen disponibles para `latexmk`; no se reutiliza el PASS de compilación de septiembre. Esta limitación no afecta a los tres PDF entregados y revisados.

## Actualización del 2 de octubre de 2026

La jornada local completa terminó **PASS (390 minutos reales)** el 2 de octubre de 2026, con 124/124 anuncios completados y 422 comprobaciones de integridad correctas. Véase el [resultado de jornada del 2 de octubre](resultado-jornada-2026-10-02.md). Este resultado posterior resuelve el pendiente de resistencia local; la aceptación del hardware destino y del candidato/instalador final permanece separada.

# Comal++ 0.3.1: corrección de carpetas protegidas

> **Registro histórico / evidencia fechada.** Resultados, hashes, conteos y pendientes corresponden a la ejecución descrita, no a cualquier compilación posterior con el mismo número de versión. Consulte [documentación vigente](README.md), [revisión del 1 de octubre](actualizacion-documentacion-2026-10-01.md) y [lista de publicación](lista-publicacion.md) para cambios y aceptación actual. Se conserva el cuerpo original como evidencia.

> **Evidencia de una compilación local del 27 de septiembre de 2026.** Este documento conserva hashes y resultados de ese artefacto; no sustituye la validación del commit actual ni la ejecución del workflow de release unsigned.

Compilación local del 27 de septiembre de 2026. Pendiente de aceptación en la computadora de destino y de firma pública.

- Instalador: `release/Comal++ Setup 0.3.1.exe`.
- SHA-256: `13C40B9BF9AE16D95E04EA88DD27235349E437AD61DF73C6EE48A7CB047AC724`.
- Authenticode del instalador y ejecutable: `NotSigned`. Los mensajes de electron-builder que dicen «signing with signtool» no demuestran una firma cuando no hay certificado configurado.
- Datos: perfil de aplicación (`userData/datos`), normalmente `%APPDATA%/comal-local/datos`; migración por copia desde Documentos sin alterar los originales.
- Acceso directo: menú Inicio. No se crea ni elimina el del Escritorio.
- Actualización: los desinstaladores históricos compatibles reciben `--keep-shortcuts`, incluso al cambiar la ruta de instalación. Un acceso antiguo del Escritorio puede quedar apuntando a la ubicación anterior; abrir desde Inicio.
- Licencia del código propio: MIT. Solicitud SignPath todavía no enviada ni aprobada; ver [preparación de firma](firma-publica-gratuita.md).

## Validación

- Suite de dominio/proceso principal de esa compilación: 92 pruebas aprobadas; la suite actual puede tener un conteo distinto. Use `npm test` para el estado vigente.
- Catálogo: 100 voces y aviso válidos.
- Compilación, ESLint y formato de los archivos modificados: correctos.
- Instalación final y actualización desde el instalador histórico 0.3.0 a una carpeta diferente: correctas. Se llamó 42 con ruta de prueba y 43 usando la ruta predeterminada sin `TURNERO_DATOS`; ambos persistieron tras reiniciar.
- Intervalo final: `2026-09-27T07:08:47.984Z` a `2026-09-27T07:09:19.146Z` (01:08:47–01:09:19 de Ciudad de México). Sin eventos 1123 detectados para el instalador, aplicación o desinstaladores, incluyendo `old-uninstaller.exe` en el temporal de Windows.
- Evidencia local: `test-results/installed-XyMMdQ/resultado.json`. El instalador anterior usado tenía SHA-256 `52BDB98B18B34B294E84632433CCE62DC705FEF59A3DBEE6376995A581AA2821`.
- La actualización/reversión desde 0.2.0 también pasó en una compilación intermedia, antes del último ajuste de accesos directos. Esa evidencia no valida el hash final ni ausencia de avisos: `test-results/upgrade-nR0FJB/resultado.json`.

Los reportes iniciales `installed-hotLjD` e `installed-j1Lm3S` no acreditan ausencia de bloqueos: el primero no consultaba Defender y el segundo no incluía el desinstalador temporal. El reporte final anterior los sustituye para este criterio.

No se desactivó Defender, SmartScreen ni el acceso controlado a carpetas; no se añadieron exclusiones o certificados de confianza. Las pruebas no sustituyen la aceptación con la pantalla, bocinas y políticas de Windows 11 de destino. La firma pública sigue pendiente y SmartScreen puede mostrar avisos de reputación.

# CI/CD vigente · Comal++ 1.0.0

Revisado contra los workflows el 12 de noviembre de 2026. CI corre en pull requests, pushes a main/master/development y ejecución manual. Configure protección de rama para exigir **Formatting, lint, tests and security** y **Windows application and installer**.

## Validación

`validate.yml` ejecuta primero formato, lint, pruebas unitarias/catálogo, recuperación CLI y auditoría high/critical. Luego construye el fixture 0.2.0 fijado en `legacy-installer.yml` y el trabajo Windows:

- Build de la aplicación una vez.
- Smoke de escritorio, navegador, anuncios/importación, multimedia, controles de audio, interfaz, tema y centro de ayuda con recorridos.
- Auditoría automática de accesibilidad con axe-core; no equivale a una certificación.
- Preflight de jornada, que no equivale a jornada completa.
- Instalador unsigned para pruebas, instalación y actualización/reversión contra el fixture cuyo SHA-256 se comprueba.

El instalador validado se conserva siete días; diagnósticos y capturas se conservan también al pasar el trabajo Windows. El fixture 0.2.0 solo se usa para pruebas, no para distribución.

La suite QA de `qa/` (`npm run qa:integration`, `qa:ui` y `qa:regression`) **no forma parte de CI ni de CD**: necesita Docker con TestLink local y un navegador para Selenium. Se ejecuta en el equipo de QA y su resultado se conserva en el [reporte final](../qa/management/reporte-final.md).

`format` y `format:check` cubren los mismos directorios de código y workflows. Markdown/LaTeX y manuales requieren revisión documental separada. `.gitattributes`, Prettier y EditorConfig usan LF; `npm ci` reproduce el formatter del lockfile.

## Publicación firmada

`cd.yml` repite la validación en tags de versión. Publicar exige que el tag sea `v` más la versión de `package.json`, entorno **production**, ambos secretos **WIN_CSC_LINK/WIN_CSC_KEY_PASSWORD** y **COMAL_SIGNER_SHA1** con la huella aprobada de 40 caracteres.

La publicación **falla si falta identidad**; no hay salida unsigned. Se construye el instalador firmado con `--publish never`, se prueba su instalación y se verifican Setup, app instalada y desinstalador: firma válida, uso de firma de código, huella exacta y timestamp. Se compara el hash con la evidencia instalada y se repite upgrade/rollback sobre ese artefacto.

Se publican instalador, blockmap cuando existe, **SHA256.txt** y **SBOM.cdx.json**. El SBOM es de dependencias instaladas de construcción y no acredita derechos de voces/imágenes/marcas. GitHub Release se prepara como borrador y se publica después de subir archivos; se rechaza reemplazar una release existente.

Una ejecución manual en rama valida sin publicar. Un tag existente puede publicar si coincide y no existe release. Declarar `production` en YAML no prueba revisores o restricciones: el responsable debe comprobarlos en GitHub.

### Configuración inicial y diagnóstico

En **Settings → Environments → production**, configura:

- **Secret `WIN_CSC_LINK`**: certificado de firma de código y clave privada en un PFX, mediante un valor admitido por electron-builder para `WIN_CSC_LINK`, por ejemplo su contenido en base64. Una ruta de tu PC no estará disponible en un runner hospedado.
- **Secret `WIN_CSC_KEY_PASSWORD`**: contraseña del PFX.
- **Variable `COMAL_SIGNER_SHA1`**: huella SHA-1 aprobada del certificado, exactamente 40 caracteres hexadecimales sin espacios.

No incluyas el certificado ni su contraseña en commits, issues o mensajes. Estos datos requieren un certificado existente; el workflow no emite certificados ni integra automáticamente SignPath. Consulta la [guía de firma](firma-publica-gratuita.md) para distinguir las alternativas.

Antes de instalar dependencias o empaquetar, `scripts/verify-release.mjs` comprueba la etiqueta y las tres configuraciones. Reporta todos los faltantes juntos y escribe `test-results/release-preflight.json`, incluso al fallar. La evidencia contiene indicadores de presencia/validez, nunca los valores secretos. El paso de conservación solo se ejecuta después de que se haya intentado el preflight, evitando un error secundario por falta de evidencias cuando la preparación del runner falla antes.

En CD **41881505949**, la validación completa aprobó, pero la publicación recibió vacíos los tres ajustes de firma. La comprobación posterior confirmó que no había secretos de repositorio ni secretos/variables de `production`. Corregir esa configuración es necesario para publicar; reintentar sin ella volverá a fallar. La etiqueta `v1.0.0` no tenía una release publicada al realizar este diagnóstico.

## Jornada operacional

`release.yml` es la prueba manual separada de **390 minutos (6 h 30 min)**, en runner Windows propio con etiqueta `comal-production` y entorno protegido `production`. No es el workflow que publica la release. Su grupo de concurrencia evita jornadas simultáneas en ese runner.

Ni la CI ni este documento prueban sonido HDMI físico o reproducción real de servicios externos. Consulte [la jornada](prueba-jornada-real.md) y [la lista de publicación](lista-publicacion.md).

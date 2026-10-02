# CI/CD vigente · Comal++ 0.3.1

Revisado contra los workflows el 1 de octubre de 2026. CI corre en pull requests, pushes a main/master/development y ejecución manual. Configure protección de rama para exigir **Formatting, lint, tests and security** y **Windows application and installer**.

## Validación

`validate.yml` ejecuta primero formato, lint, pruebas unitarias/catálogo, recuperación CLI y auditoría high/critical. Luego construye el fixture 0.2.0 fijado en `legacy-installer.yml` y el trabajo Windows:

- Build de la aplicación una vez.
- Smoke de escritorio, navegador, anuncios/importación, multimedia, controles de audio, interfaz y tema.
- Preflight de jornada, que no equivale a jornada completa.
- Instalador unsigned para pruebas, instalación y actualización/reversión contra el fixture cuyo SHA-256 se comprueba.

El instalador validado se conserva siete días; diagnósticos y capturas se conservan también al pasar el trabajo Windows. El fixture 0.2.0 solo se usa para pruebas, no para distribución.

`format` y `format:check` cubren los mismos directorios de código y workflows. Markdown/LaTeX y manuales requieren revisión documental separada. `.gitattributes`, Prettier y EditorConfig usan LF; `npm ci` reproduce el formatter del lockfile.

## Publicación firmada

`cd.yml` repite la validación en tags de versión. Publicar exige que el tag sea `v` más la versión de `package.json`, entorno **production**, ambos secretos **WIN_CSC_LINK/WIN_CSC_KEY_PASSWORD** y **COMAL_SIGNER_SHA1** con la huella aprobada de 40 caracteres.

La publicación **falla si falta identidad**; no hay salida unsigned. Se construye el instalador firmado con `--publish never`, se prueba su instalación y se verifican Setup, app instalada y desinstalador: firma válida, uso de firma de código, huella exacta y timestamp. Se compara el hash con la evidencia instalada y se repite upgrade/rollback sobre ese artefacto.

Se publican instalador, blockmap cuando existe, **SHA256.txt** y **SBOM.cdx.json**. El SBOM es de dependencias instaladas de construcción y no acredita derechos de voces/imágenes/marcas. GitHub Release se prepara como borrador y se publica después de subir archivos; se rechaza reemplazar una release existente.

Una ejecución manual en rama valida sin publicar. Un tag existente puede publicar si coincide y no existe release. Declarar `production` en YAML no prueba revisores o restricciones: el responsable debe comprobarlos en GitHub.

## Jornada operacional

`release.yml` es la prueba manual separada de **390 minutos (6 h 30 min)**, en runner Windows propio con etiqueta `comal-production` y entorno protegido `production`. No es el workflow que publica la release. Su grupo de concurrencia evita jornadas simultáneas en ese runner.

Ni la CI ni este documento prueban sonido HDMI físico o reproducción real de servicios externos. Consulte [la jornada](prueba-jornada-real.md) y [la lista de publicación](lista-publicacion.md).

# Seguridad, calidad y publicación de Windows

Esta aplicación es Electron local. Las dos vistas cargan desde `turnero://app` en producción; el servidor Vite en `127.0.0.1:5173` se usa solo durante desarrollo. El proceso principal conserva el estado y los archivos. No hay servicio web ni base de datos.

## Comprobaciones automáticas

Antes de publicar, ejecutar con Node.js 22 o posterior en Windows:

```powershell
npm ci
npm run format:check
npm run lint
npm test
npm run build
npm run test:desktop
npm audit --audit-level=high
npm outdated
```

`npm outdated` devuelve código 1 cuando encuentra paquetes más recientes; requiere revisión, no una actualización automática. `npm audit` consulta el registro npm y falla en CI con avisos **high** o **critical**. Si el registro no responde, la auditoría no está completa y se debe repetir. `npm ci` verifica que `package-lock.json` reproduce la instalación. Revisar dependencias de producción y desarrollo, el alcance de cada aviso y la ruta de corrección antes de cambiar versiones. Registrar en la revisión de publicación el paquete afectado, versión, severidad, decisión y fecha.

`package.json` no declara dependencias de producción: React, Electron y el empaquetador están en `devDependencies`, y el instalador incluye los archivos compilados indicados en la configuración de `electron-builder`. Por ello, la revisión de seguridad incluye también todas las dependencias de desarrollo y el contenido real del instalador.

El 25 de septiembre de 2026 (hora de México), `npm audit --json` informó **0 vulnerabilidades** (0 de severidad low, moderate, high y critical) entre 644 dependencias después de agregar ESLint. `npm outdated` señaló `@eslint/js`, `@types/node`, `@vitejs/plugin-react`, `electron`, `eslint`, `globals`, `prettier`, `tsx`, `typescript` y `vite`; no se actualizaron como parte de esta fase. ESLint 9 se conserva porque los complementos de React y accesibilidad aún declaran compatibilidad hasta esa versión mayor. Las versiones mayores de Vite y TypeScript requieren una evaluación separada.

La CI de GitHub Actions corre en Windows al abrir o actualizar un pull request y al enviar cambios a `copilot/comal-interactive-mockup`. Usa Node.js 22, instala desde el lockfile y ejecuta los comandos anteriores, salvo `npm outdated`, que se revisa manualmente. Si falla el smoke de escritorio, guarda capturas y registros de `test-results/`. El smoke requiere un escritorio Windows capaz de iniciar Electron; comprueba que se crea el iframe de YouTube, pero no exige que el video externo se reproduzca por internet. El clima y la reproducción real de YouTube requieren internet y se aceptan por separado en el equipo de destino. `npm audit` y `npm outdated` también requieren acceso al registro npm.

## Política de contenido y navegación

La CSP de producción se entrega como cabecera en las páginas HTML de `turnero://app`. La política permite el propio origen, la API de iframe de YouTube y sus recursos de script, el iframe de YouTube, y la consulta de clima a Open-Meteo. `object-src 'none'` y `base-uri 'none'` permanecen bloqueados. Cualquier origen externo nuevo exige cambiar la CSP de forma explícita y probarlo. Las ventanas rechazan nuevas ventanas y navegación principal fuera de la página prevista. La vista pública no puede abrir páginas remotas arbitrarias. Los archivos locales no envían una cabecera CORS comodín; las vistas acceden a ellos desde el mismo origen `turnero://app`.

`style-src 'unsafe-inline'` sigue siendo necesario por los estilos dinámicos que React aplica mediante atributos `style` en el menú y el ticker; quitarlo hoy rompería esos elementos. La política de **producción** no permite scripts inline ni `unsafe-eval`. La política de **desarrollo** permite `script-src 'unsafe-inline'` porque el complemento React de Vite inyecta su preámbulo de recarga rápida como script inline; Vite también usa el origen local y WebSocket para recarga. La política de desarrollo se prueba por separado de la cabecera del protocolo de producción. El contenido `turnero://app/contenido` solo sirve archivos bajo la carpeta local autorizada. La CSP del documento principal no gobierna el interior del iframe de YouTube.

## Límite IPC

El preload aislado expone solo `window.turnero`. Cada llamada IPC debe venir de la ventana esperada, desde su marco principal y desde la URL local de la vista. La vista pública solo puede leer estado, escribir mensajes de registro acotados y ajustar el volumen de sus iframes de YouTube; las acciones de turnos, configuración y multimedia son del operador. El proceso principal valida tipos, categorías, URLs, tamaños y rangos en ejecución. El selector de archivos se abre en el proceso principal; ningún canal acepta una ruta de origen arbitraria suministrada por el renderizador. Los errores de validación se devuelven de forma controlada.

## Firma de código y publicación

El responsable de publicación debe obtener un certificado de firma de código para Windows de una autoridad de certificación reconocida por Windows (o usar un proveedor de firma administrada compatible con `electron-builder`). No guardar certificados, contraseñas ni tokens en este repositorio. Para la opción de archivo PFX, `electron-builder` lee `WIN_CSC_LINK` (ruta o enlace seguro al certificado) y `WIN_CSC_KEY_PASSWORD` del entorno; también admite `CSC_LINK` y `CSC_KEY_PASSWORD` como respaldo. Inyectarlos solo durante el trabajo de publicación desde un almacén de secretos, nunca en argumentos de consola, archivos `.env` versionados o registros. En GitHub Actions, usar secretos cifrados y un entorno protegido con revisión; no exponerlos a pull requests de bifurcaciones. No se ha configurado publicación automática con secretos. Ver la [guía de firma de electron-builder](https://www.electron.build/v26/docs/features/code-signing/code-signing-win/).

La compilación de desarrollo sin certificado sigue disponible con `npm run desktop:build`. La orden `npm run desktop:build:signed` exige que `electron-builder` encuentre una identidad de firma y debe fallar sin ella. Verificar tanto el ejecutable instalado como el instalador desde PowerShell:

```powershell
Get-AuthenticodeSignature -FilePath 'ruta\al\instalador.exe' | Format-List Status,SignerCertificate,TimeStamperCertificate
Get-AuthenticodeSignature -FilePath 'ruta\a\Comal++.exe' | Format-List Status,SignerCertificate,TimeStamperCertificate
```

Ambos deben mostrar `Status: Valid`, el firmante esperado y un sello de tiempo válido. También puede usarse `signtool verify /pa /v` del Windows SDK. No hay certificados locales configurados en este proyecto; la firma y su verificación final corresponden al responsable de publicación.

### Lista de publicación

1. Revisar el diff, el estado Git y los resultados de CI; resolver fallos de formato, lint, pruebas, build y auditoría.
2. Ejecutar el smoke de escritorio en Windows y comprobar audio, multimedia local y pantalla secundaria real. Probar YouTube y clima con internet si se usarán en operación.
3. Construir el instalador firmado con el certificado autorizado y registrar versión, hash SHA-256 y fecha.
4. Verificar la firma del instalador y del ejecutable instalado; rechazar cualquier artefacto sin `Status: Valid`.
5. Instalar y probar el artefacto exacto en una cuenta estándar, conservando y restaurando los datos de operación.

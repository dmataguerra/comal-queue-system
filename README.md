# Turnero Comal++

Aplicación local de Windows para llamar pedidos listos. La persona operadora captura los dos últimos dígitos del ticket (00–99), y la pantalla pública muestra el turno y reproduce el aviso y la voz correspondientes. El sistema no registra ventas ni imprime tickets.

## Estado actual

La rama actual es `codex/comal-architecture-refactor` y este estado corresponde al commit `d6030b10f4063ccc3f050a8ebce497f6cde82cd1`. El arbol Git esta limpio despues de publicar los cambios de arquitectura, interfaz, smoke tests y documentacion. La version del proyecto es `0.3.0`; el instalador debe reconstruirse desde un commit limpio antes de una entrega.

## Arquitectura actual

Electron ejecuta un proceso principal y dos ventanas construidas con React y Vite: **operador** y **pública**. Las ventanas se comunican con el proceso principal mediante IPC. El mismo proceso ofrece ambas vistas a navegadores de la **misma PC** en `http://127.0.0.1:4317/` (operador) y `http://127.0.0.1:4317/publica` (pantalla pública). El servidor solo escucha en la interfaz local; no admite acceso desde otros equipos. La lógica de turnos y cola está en `nucleo/`. El estado de la jornada se guarda en `estado.json`, y las opciones se leen de `config.json`.

En Windows, la pantalla pública se coloca en la pantalla secundaria configurada como **pantalla extendida**. Sin una pantalla secundaria, la aplicación empaquetada abre solo la ventana del operador. En desarrollo, la ventana pública también puede abrirse en el monitor principal para pruebas.

La carpeta de datos de producción es `Documentos/Turnero Comal`. Puede cambiarse con la variable `TURNERO_DATOS` para pruebas aisladas. Contiene `config.json`, `estado.json`, `turnero.log` y `contenido/`. El instalador incluye contenido de fábrica que se copia a esa carpeta en el primer arranque. Los archivos locales de `contenido/videos`, `contenido/banner`, `contenido/voz` y `contenido/aviso.wav` se usan sin red. Para cada voz y para el aviso, la aplicación prefiere MP3 no vacío cuando existe; de lo contrario usa WAV.

Los turnos, el estado y el contenido local funcionan sin internet. YouTube y el clima requieren internet. Si YouTube falla o el sistema detecta la perdida de conexion, la pantalla publica usa el contenido local; al reconectarse intenta de nuevo la fuente configurada. El servidor HTTP local solo sirve las dos vistas y el transporte de navegador en `127.0.0.1`; no expone una API de administracion a la red.

Desde **Ayuda**, el operador puede abrir **Diagnósticos** para revisar versiones, rutas de datos, estado de ventanas, último guardado, errores recientes, audio, YouTube, inventario y espacio libre cuando Windows permite consultarlo. Los detalles técnicos no aparecen en la pantalla pública. El registro `turnero.log` usa líneas JSON y rota al llegar a 5 MB; conserva hasta cinco archivos anteriores (`turnero.log.1` a `.5`).

## Requisitos y uso

- Windows con Node.js 22.13 o posterior y npm para desarrollar o generar el instalador.
- Dos pantallas en modo extendido y salida de audio adecuada para la operación en el local.

```powershell
npm ci
npm run dev
```

`npm run dev` inicia Vite y Electron para desarrollo. Para ejecutar el código compilado desde el repositorio:

```powershell
npm run build
npm start
```

Para crear el instalador Windows NSIS de la versión indicada en `package.json`:

```powershell
npm run desktop:build
```

El instalador se escribe en `release/`. `npm run desktop:dir` genera una carpeta de aplicación sin instalador. Para una publicación firmada, usar `npm run desktop:build:signed` con el certificado del responsable de publicación.

Para una instalación controlada solo en la PC de la cafetería, existe además `npm run desktop:build:local-signed`: exige un certificado de firma con clave no exportable protegida por el TPM de esta PC de desarrollo. La [guía de firma local](docs/firma-local.md) explica sus límites y requisitos; todavía no se ha emitido ese certificado. Una firma local gratuita no elimina por sí sola los avisos de SmartScreen ni impide copiar la aplicación.

## Validación

```powershell
npm run format
npm run format:check
npm run verify:audio
npm test
npm run build
npm run test:desktop
npm run test:browser
npm run test:installed
npm run test:upgrade
npm run lint
```

`npm test` incluye la validación del catálogo de audio y las pruebas del dominio y del proceso principal. El validador exige una voz para cada número 00–99, rechaza archivos de audio vacíos y revisa el aviso. `npm run test:desktop` usa datos aislados bajo `test-results/`, comprueba ambas vistas, llamadas y multimedia, y decodifica en Chromium las 100 voces seleccionadas y el aviso. Comprueba que se crea el iframe de YouTube; la reproducción real requiere una aceptación aparte con internet. La herramienta de generación y sus instrucciones están en `tooling/audio/`.

`npm run test:installed` requiere un instalador ya construido. Lo instala en `test-results/`, ejecuta el `.exe` instalado con datos aislados, comprueba una llamada y su recuperación tras reiniciar, y registra el hash probado en `resultado.json`. Para probar otro instalador: `node scripts/smoke-installed.mjs 'ruta\al\instalador.exe'`. No sustituye las pruebas con cuenta estándar, actualización, reversión ni hardware real.

`npm run test:browser` abre las vistas en un navegador Chromium sin preload de Electron, verifica llamadas y sincronización, y comprueba que las peticiones externas no puedan despachar turnos. El servidor local arranca junto con la aplicación; si el puerto 4317 está ocupado, la aplicación de escritorio continúa y registra el problema en `turnero.log`.

`npm run test:upgrade` usa el instalador 0.2.0 archivado y el 0.3.0 actual en una carpeta aislada. Crea un turno en SQLite 0.2.0, comprueba su migración a 0.3.0 y después reinstala 0.2.0 con el perfil respaldado. El primer arranque de 0.3.0 migra los turnos listos de la jornada y mensajes de configuración cuando aún no existe `estado.json`; deja intacta la base SQLite anterior.

La escala de la pantalla publica se valida con `npx electron scripts/smoke-display-scale.mjs` despues de `npm run build`; comprueba la composicion 16:9 en ventanas Full HD, 1440p y 4K. La firma local protegida por TPM se prepara con `npm run desktop:build:local-signed` y `COMAL_SIGNING_CERT_SHA1`; no hay todavia un certificado emitido ni un instalador firmado aprobado.

## Estructura

- `main/`: proceso principal de Electron, ventanas, IPC, configuración, contenido y persistencia.
- `nucleo/`: reglas de turnos y cola sin dependencia de Electron.
- `vistas/`: interfaces React del operador y la pantalla pública.
- `contenido/`: contenido de fábrica para instalaciones nuevas.
- `tooling/audio/`: generación y validación del catálogo de voz.
- `scripts/`: desarrollo y prueba de escritorio.
- `docs/`: arquitectura vigente y documentación histórica. Algunos documentos `.tex` describen la implementación anterior; no son instrucciones de despliegue actuales.

## Limitaciones conocidas

- La aplicación empaquetada necesita una pantalla secundaria para mostrar la vista pública.
- Chrome y Edge pueden abrir el operador y la vista pública en la misma PC. El acceso desde teléfonos u otros equipos no está habilitado.
- El operador ve si la vista pública de Electron terminó o falló al reproducir el audio de cada turno. Este acuse de software no confirma la salida física por HDMI o bocinas.
- Si falla el guardado de un turno, la acción se rechaza: la cola y la TV no cambian. Corrija disco o permisos y vuelva a intentar.
- Al arrancar se reparan voces 00–99 y `aviso` faltantes o vacíos desde el contenido de fábrica sin sobrescribir audio personalizado válido. Banners y videos eliminados no se reponen automáticamente.
- YouTube y el clima dependen de servicios externos. El contenido local se usa como respaldo cuando YouTube falla; la detección de una conexión intermitente puede tardar hasta 20 segundos y requiere validación en la red real.
- La aceptación final requiere pruebas en la PC, TV, bocinas y escala de pantalla reales del local.

## Documentación

La [arquitectura vigente](docs/current-architecture.md) describe el diseño Electron instalado, incluido el servidor HTTP local y sus limites. [Arquitectura](docs/arquitectura.md) conserva topologias historicas y propuestas futuras que aun no estan implementadas. La documentacion LaTeX en `docs/` debe leerse como referencia historica salvo que indique lo contrario.

La [guía de operación y recuperación](docs/operacion-recuperacion.md) explica el guardado atómico, la salud de persistencia, los límites de importación, los respaldos y la restauración con la aplicación cerrada. La [lista de publicación](docs/lista-publicacion.md) recoge las comprobaciones de cada instalador.
La [guía de seguridad y publicación](docs/seguridad-y-publicacion.md) describe ESLint, CI, auditoría de dependencias, CSP, IPC y firma de Windows.
La [lista de publicación de 0.3.0](docs/publicacion-0.3.0.md) registra el instalador local verificado y la aceptación pendiente para una entrega final.

No se ha documentado una licencia de distribución para este repositorio.

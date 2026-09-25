# Turnero Comal++

Aplicación local de Windows para llamar pedidos listos. La persona operadora captura los dos últimos dígitos del ticket (00–99), y la pantalla pública muestra el turno y reproduce el aviso y la voz correspondientes. El sistema no registra ventas ni imprime tickets.

## Arquitectura actual

Electron ejecuta un proceso principal y dos ventanas construidas con React y Vite: **operador** y **pública**. Las ventanas se comunican con el proceso principal mediante IPC; no hay servidor local ni acceso desde un navegador. La lógica de turnos y cola está en `nucleo/`. El estado de la jornada se guarda en `estado.json`, y las opciones se leen de `config.json`.

En Windows, la pantalla pública se coloca en la pantalla secundaria configurada como **pantalla extendida**. Sin una pantalla secundaria, la aplicación empaquetada abre solo la ventana del operador. En desarrollo, la ventana pública también puede abrirse en el monitor principal para pruebas.

La carpeta de datos de producción es `Documentos/Turnero Comal`. Puede cambiarse con la variable `TURNERO_DATOS` para pruebas aisladas. Contiene `config.json`, `estado.json`, `turnero.log` y `contenido/`. El instalador incluye contenido de fábrica que se copia a esa carpeta en el primer arranque. Los archivos locales de `contenido/videos`, `contenido/banner`, `contenido/voz` y `contenido/aviso.wav` se usan sin red. Para cada voz y para el aviso, la aplicación prefiere MP3 no vacío cuando existe; de lo contrario usa WAV.

Los turnos, el estado y el contenido local funcionan sin internet. YouTube y el clima requieren internet. Si YouTube falla o el sistema detecta la pérdida de conexión, la pantalla pública usa el contenido local; al reconectarse intenta de nuevo la fuente configurada.

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

## Validación

```powershell
npm run format
npm run format:check
npm run verify:audio
npm test
npm run build
npm run test:desktop
npm run lint
```

`npm test` incluye la validación del catálogo de audio y las pruebas del dominio y del proceso principal. El validador exige una voz para cada número 00–99, rechaza archivos de audio vacíos y revisa el aviso. `npm run test:desktop` usa datos aislados bajo `test-results/`, comprueba ambas vistas, llamadas y multimedia, y decodifica en Chromium las 100 voces seleccionadas y el aviso. Comprueba que se crea el iframe de YouTube; la reproducción real requiere una aceptación aparte con internet. La herramienta de generación y sus instrucciones están en `tooling/audio/`.

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
- No hay acceso operativo desde Chrome, Edge o un teléfono.
- La entrega efectiva del anuncio y del audio a la TV no tiene acuse de recibo visible para el operador.
- Si falla el guardado de turnos, el operador ve una advertencia persistente. Los cambios en memoria pueden perderse tras reiniciar hasta que un guardado posterior tenga éxito.
- Si la primera copia del contenido de fábrica falla o una instalación anterior ya tiene una carpeta `contenido/` incompleta, el arranque no repara automáticamente los archivos faltantes.
- YouTube y el clima dependen de servicios externos. El contenido local se usa como respaldo cuando YouTube falla; la detección de una conexión intermitente puede tardar hasta 20 segundos y requiere validación en la red real.
- La aceptación final requiere pruebas en la PC, TV, bocinas y escala de pantalla reales del local.

## Documentación

La [arquitectura local](docs/arquitectura.md) describe el diseño Electron. También incluye topologías futuras que aún no están implementadas. La documentación LaTeX en `docs/` conserva material histórico del sistema anterior y debe leerse como referencia, no como descripción del producto actual.

La [guía de operación y recuperación](docs/operacion-recuperacion.md) explica el guardado atómico, la salud de persistencia, los límites de importación, los respaldos y la restauración con la aplicación cerrada. La [lista de publicación](docs/lista-publicacion.md) recoge las comprobaciones de cada instalador.
La [guía de seguridad y publicación](docs/seguridad-y-publicacion.md) describe ESLint, CI, auditoría de dependencias, CSP, IPC y firma de Windows.
La [lista de publicación de 0.3.0](docs/publicacion-0.3.0.md) registra el commit base, los comandos, la salida del instalador, el hash y la prueba manual pendiente para la versión final.

No se ha documentado una licencia de distribución para este repositorio.

<div align="center">

<img src="docs/readme/media/trojano.png" width="128" height="128" alt="Casco troyano de Comal++ en pixel art">

# Comal++

### El siguiente pedido, en pantalla.

Sistema de turnos de **El Comal** para la **Facultad de Informática (FIF), Universidad Autónoma de Querétaro**.

Dos pantallas. Avisos por voz. Operación local.

[Demostración](#demostración) · [Comenzar](#primeros-pasos) · [Documentación](#documentación) · [Reportar un problema](https://github.com/dmataguerra/comal-queue-system/issues)

[Integración continua](https://github.com/dmataguerra/comal-queue-system/actions/workflows/ci.yml) · [Publicaciones](https://github.com/dmataguerra/comal-queue-system/releases) · Windows x64 · [MIT](LICENSE)

</div>

![Separador pixel art](docs/readme/media/separador.svg)

## Demostración

![Comal++ funcionando: operador a la izquierda y pantalla pública a la derecha](docs/readme/media/comal-dos-pantallas.gif)

**Una llamada, dos vistas sincronizadas.** La persona operadora captura el ticket; la pantalla pública presenta el pedido listo y el sistema reproduce su aviso por voz.

[Ver o descargar el video MP4](docs/readme/media/comal-dos-pantallas.mp4) · [Abrir la captura completa](docs/readme/media/dos-pantallas.png)

La vista previa muestra las dos ventanas reales con datos de demostración. El GIF y el video no incluyen audio; la reproducción por voz forma parte de la aplicación.

<details>
<summary>Explorar el proyecto</summary>

- [Acerca del proyecto](#acerca-del-proyecto)
- [Capturas del sistema](#capturas-del-sistema)
- [Construido con](#construido-con)
- [Primeros pasos](#primeros-pasos)
- [Configuración de pantallas](#configuración-de-pantallas)
- [Datos y recuperación](#datos-y-recuperación)
- [Documentación](#documentación)
- [Calidad y publicación](#calidad-y-publicación)
- [Contribuir](#contribuir)
- [Principales colaboradores](#principales-colaboradores)
- [Contacto](#contacto)
- [Licencia](#licencia)

</details>

## Acerca del proyecto

Comal++ acompaña la entrega de pedidos en el mostrador de El Comal. Permite anunciar un pedido desde la computadora de operación y mostrarlo en una TV, junto con contenido multimedia e información para la comunidad de la FIF.

La persona operadora escribe entre uno y seis dígitos del ticket. El sistema utiliza los **dos últimos dígitos**, del `00` al `99`, para el llamado. Por ejemplo, el ticket `213298` se anuncia como **98**. El programa no registra ventas ni imprime tickets.

| En el mostrador                               | En la pantalla pública                       |
| --------------------------------------------- | -------------------------------------------- |
| Captura, repetición y corrección de llamados. | Pedido actual y hasta seis turnos recientes. |
| Controles de volumen y multimedia.            | Aviso sonoro y voz del número anunciado.     |
| Ayuda por tareas y acceso con **F1**.         | Imágenes y videos locales, reloj y mensajes. |
| Diagnósticos y recuperación de datos.         | Ventana independiente para la TV.            |

Los turnos, las voces y el contenido local funcionan **sin internet**. YouTube y el clima dependen de servicios externos. YouTube está disponible en escritorio; la vista de navegador utiliza contenido local.

## Capturas del sistema

### Estación de operación

![Interfaz real para capturar y administrar llamados](docs/readme/media/operador.png)

### Pantalla pública

![Interfaz real de pedidos listos y contenido multimedia](docs/readme/media/publica.png)

Las capturas conservan la apariencia original del programa. El casco troyano, los iconos y los bordes decorativos utilizan pixel art; los títulos y el contenido del README son texto Markdown.

![Separador pixel art](docs/readme/media/separador.svg)

## Construido con

<p align="center">
  <img src="docs/readme/media/tecnologias/electron.svg" width="64" height="64" alt="Electron">
  <img src="docs/readme/media/tecnologias/react.svg" width="64" height="64" alt="React">
  <img src="docs/readme/media/tecnologias/typescript.svg" width="64" height="64" alt="TypeScript">
  <img src="docs/readme/media/tecnologias/vitejs.svg" width="64" height="64" alt="Vite">
  <img src="docs/readme/media/tecnologias/tailwindcss.svg" width="64" height="64" alt="Tailwind CSS">
  <img src="docs/readme/media/tecnologias/nodejs.svg" width="64" height="64" alt="Node.js">
  <img src="docs/readme/media/tecnologias/githubactions.svg" width="64" height="64" alt="GitHub Actions">
</p>

Iconos de [Devicon](https://github.com/devicons/devicon/tree/v2.17.0), adaptados a pixel art. [Créditos y licencia](docs/readme/README.md#iconos-de-tecnologías).

| Tecnología              | Uso en Comal++                                         |
| ----------------------- | ------------------------------------------------------ |
| Electron 44             | Aplicación de escritorio y administración de ventanas. |
| React 19                | Interfaces del operador y del público.                 |
| TypeScript 5            | Reglas de negocio y contratos entre componentes.       |
| Vite 7 y Tailwind CSS 4 | Compilación y estilos de las vistas.                   |
| Archivos JSON locales   | Configuración y estado persistente.                    |
| electron-builder y NSIS | Instalador para Windows x64.                           |
| GitHub Actions          | Integración continua y publicación.                    |

El núcleo de turnos vive en `nucleo/`; Electron coordina ventanas, persistencia, audio y comunicación validada con las vistas. La [arquitectura vigente](docs/current-architecture.md) describe sus responsabilidades y límites.

## Primeros pasos

### Para instalar y operar

Necesitas una **PC con Windows x64**, una TV o pantalla secundaria y una salida de audio con bocinas. Configura Windows en modo extendido y comprueba el sonido que escuchará el público.

1. Consulta las [publicaciones disponibles](https://github.com/dmataguerra/comal-queue-system/releases) y las instrucciones de la versión elegida.
2. Instala el paquete Windows correspondiente siguiendo la [guía de instalación](README-INSTALACION-USB.md).
3. Abre Comal++, comprueba la pantalla pública y realiza un llamado de prueba.
4. Usa **Ayuda** o **F1** para consultar los procedimientos dentro del programa.

**Versión estable: `v1.0.0`.** Consulta las [notas de esta entrega](docs/publicacion-1.0.0.md). El instalador estará disponible en Publicaciones cuando finalice el proceso automático de validación y firma.

### Para desarrollar

Requisitos: Windows, **Node.js 22.13.0 o posterior**, npm y Git.

```powershell
git clone https://github.com/dmataguerra/comal-queue-system.git
cd comal-queue-system
npm ci
npm run dev
```

Para compilar y ejecutar:

```powershell
npm run build
npm start
```

Para generar el instalador local en `release/`:

```powershell
npm run desktop:build
```

La publicación firmada tiene requisitos adicionales descritos en la [guía de seguridad y publicación](docs/seguridad-y-publicacion.md).

## Configuración de pantallas

Selecciona **Windows + P → Extender** para mantener el panel de operación en la computadora y la ventana pública en la TV. Con una pantalla secundaria, la aplicación utiliza pantalla completa; sin ella, abre la vista pública como una ventana en la pantalla principal.

Para mostrar **la misma cola en dos TV**, conecta una salida secundaria del equipo a un **splitter HDMI de una entrada y dos salidas**. Conserva la pantalla del operador en una salida independiente. La compatibilidad de resolución y audio depende del equipo y del adaptador utilizados.

Las vistas de navegador están disponibles únicamente en la misma PC, normalmente en `http://127.0.0.1:4317/` y `http://127.0.0.1:4317/publica`. El servidor no admite conexiones desde teléfonos u otras computadoras.

## Datos y recuperación

Los datos de producción se guardan normalmente en:

```text
%APPDATA%/comal-local/datos
```

La ruta efectiva aparece en **Ayuda → Diagnósticos**. Allí se mantienen configuración, estado de turnos, registro y contenido local. Para pruebas aisladas puede establecerse `TURNERO_DATOS`.

Consulta la [guía de operación y recuperación](docs/operacion-recuperacion.md) antes de respaldar, restaurar o trasladar una instalación.

## Documentación

| Quiero…                                 | Documento                                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Aprender a utilizar el programa         | [Manual del operador](docs/user-manual/operador.md)                                                       |
| Consultar el manual visual              | [Manual PDF ilustrado, edición 0.4.0](output/pdf/Comal++_Manual_de_usuario_0.4.0.pdf)                     |
| Tener una referencia breve en mostrador | [Guía rápida del cajero](docs/user-manual/Guia-Rapida-Cajero.pdf)                                         |
| Instalar desde una memoria USB          | [Instalación y puesta en marcha](README-INSTALACION-USB.md)                                               |
| Consultar requisitos funcionales        | [Casos de uso](docs/casos-de-uso.md)                                                                      |
| Entender el diseño del sistema          | [Arquitectura vigente](docs/current-architecture.md)                                                      |
| Respaldar o recuperar datos             | [Operación y recuperación](docs/operacion-recuperacion.md)                                                |
| Conocer la ayuda integrada              | [Centro de ayuda interactivo](docs/centro-ayuda-interactivo.md)                                           |
| Revisar seguridad y distribución        | [Seguridad y publicación](docs/seguridad-y-publicacion.md)                                                |
| Preparar una entrega                    | [Lista de publicación](docs/lista-publicacion.md)                                                         |
| Revisar cambios y evidencias            | [Historial](CHANGELOG.md) · [Informe QA](docs/qa-2026-11-03.md)                                           |
| Explorar todos los documentos           | [Índice de documentación](docs/README.md) · [Documentación técnica PDF](docs/technical-documentation.pdf) |

Los documentos fechados y los manuales con número de versión conservan su contexto original. El manual del operador y la arquitectura vigente son las referencias para el funcionamiento actual.

## Calidad y publicación

La validación base antes de integrar cambios es:

```powershell
npm run format:check
npm run lint
npm test
npm run build
```

El repositorio incluye pruebas de escritorio, navegador, multimedia, accesibilidad, ayuda, recuperación e instalación. Consulta los scripts de [package.json](package.json) y las [ejecuciones de CI](https://github.com/dmataguerra/comal-queue-system/actions/workflows/ci.yml) para conocer los controles aplicados a cada cambio.

El preflight de jornada se ejecuta con `npm run test:full-day:preflight` después de compilar. La prueba `npm run test:full-day` dura **390 minutos reales**; el preflight no sustituye esa jornada. La [jornada del 2 de octubre de 2026](docs/resultado-jornada-2026-10-02.md) conserva su propia evidencia y alcance.

La aceptación de cada entrega incluye comprobar el instalador final, la PC, las TV y las bocinas del local. Los acuses de audio del software no comprueban la salida física de sonido. CD exige la identidad y firma configuradas para publicar; aprobar CI no publica por sí solo una versión.

La cola de audio admite seis anuncios, incluido el activo, y rechaza llamadas cuando está llena. Si falla el guardado de un turno, la acción se rechaza y la cola no cambia. Estas reglas se detallan en la guía operativa.

![Separador pixel art](docs/readme/media/separador.svg)

## Contribuir

Las mejoras, correcciones y propuestas de documentación son bienvenidas.

1. Revisa los [issues](https://github.com/dmataguerra/comal-queue-system/issues) y crea una rama desde la base actual.
2. Mantén el cambio enfocado y actualiza la documentación cuando cambie el comportamiento.
3. Ejecuta formato, lint, pruebas y compilación; añade las verificaciones del área afectada.
4. Crea commits atómicos con mensajes que describan el cambio.
5. Abre un pull request con el problema, el resultado esperado y la evidencia de validación.

Los cambios de persistencia, comunicación entre procesos, seguridad, audio y empaquetado requieren atención a las regresiones y la recuperación de datos.

## Principales colaboradores

Gracias a quienes han contribuido al código y a la evolución del proyecto.

| Colaborador | Perfil                                         |
| ----------- | ---------------------------------------------- |
| dmataguerra | [@dmataguerra](https://github.com/dmataguerra) |
| Alexiiis21  | [@Alexiiis21](https://github.com/Alexiiis21)   |

[Consultar todas las contribuciones](https://github.com/dmataguerra/comal-queue-system/graphs/contributors)

## Contacto

- [dmataguerra@outlook.com](mailto:dmataguerra@outlook.com)
- [acardenas22@alumnos.uaq.mx](mailto:acardenas22@alumnos.uaq.mx)

## Licencia

El código propio se distribuye bajo la [licencia MIT](LICENSE). Los recursos institucionales, el contenido multimedia y las dependencias de terceros conservan sus derechos y licencias correspondientes.

<div align="center">

**Comal++ · Facultad de Informática · UAQ**

[Volver al inicio](#comal)

</div>

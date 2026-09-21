# Turnero El Comal · Troyanos

Anunciador de pedidos listos para la cafetería de la Facultad de Informática (UAQ). Quien atiende
la barra teclea el número del ticket y presiona Enter: la TV lo muestra grande y una voz lo anuncia.

- Requerimientos y casos de uso: [docs/casos-de-uso.md](docs/casos-de-uso.md)
- Arquitectura y decisiones: [docs/arquitectura.md](docs/arquitectura.md)

Funciona **sin internet, sin red y sin base de datos**. Es una aplicación de Electron con dos
ventanas: la del operador en el monitor de la barra y la pública en pantalla completa en la TV
(topología A).

## Requisitos

- Windows 11 con dos pantallas (monitor del operador y TV por HDMI).
- Node.js 22.13 o superior, solo para desarrollar o empaquetar.

## Uso diario

| Acción | Cómo |
|---|---|
| Llamar un turno | Teclear el ticket y presionar **Enter**. Solo cuentan los dos últimos dígitos: `213298` → **98**. |
| Repetir un anuncio | Teclear el mismo número. |
| Corregir una captura | **Ctrl+Z** quita el último llamado de la TV, sin anunciar (un solo nivel). |
| Ayuda | **F1** |

La TV muestra el turno actual y hasta 5 llamados. Al día siguiente la lista arranca vacía; si se
va la luz a media jornada, al volver se recupera lo que estaba en pantalla. Si no hay una segunda
pantalla, la vista pública **no** se abre y el operador ve un aviso, para que el campo de captura
nunca aparezca en la TV.

## Desarrollo

```powershell
npm install
npm run dev      # Vite + compilación del proceso principal + Electron
npm test         # núcleo, persistencia, store, configuración y contenido
npm run build    # typecheck, vistas en dist/ y proceso principal en build/
npm start        # abre la app compilada
```

En desarrollo, con una sola pantalla, la vista pública se abre en una ventana normal para poder
verla. Empaquetada, respeta RF-13 al pie de la letra.

## Empaquetar

```powershell
npm run desktop:build   # instalador NSIS en release/
npm run desktop:dir     # carpeta sin instalador en release/win-unpacked
```

## Carpeta de datos

Instalada, en `Documentos\Turnero Comal` del usuario de Windows; en desarrollo, la raíz del
proyecto. Se puede cambiar con la variable de entorno `TURNERO_DATOS`. No vive junto al `.exe`
porque el instalador borra esa carpeta en cada actualización.

En el primer arranque se copia ahí el contenido de fábrica (voces, aviso y banner). Desde entonces
la carpeta es del administrador: lo que borre no vuelve. Para restaurar el contenido de fábrica,
borrar `contenido/` y reiniciar la app.

| Ruta | Qué es |
|---|---|
| `contenido/videos/` | Videos musicales `.mp4` (H.264 + AAC) o `.webm`. Se reproducen en orden aleatorio sin repetir. Sin videos, entra el modo banner. |
| `contenido/banner/` | Imágenes `.jpg`, `.png` o `.webp` del modo banner. |
| `contenido/voz/` | `00.wav` … `99.wav`, una frase por número. Ver [tooling/audio](tooling/audio/README.md). |
| `contenido/aviso.wav` | El *tin-tin* previo a cada anuncio. |
| `config.json` | Configuración. Se crea con valores por defecto en el primer arranque. |
| `estado.json` | Turno actual y llamados del día. Lo escribe la app de forma atómica. |
| `turnero.log` | Archivos ignorados, fallos de reproducción y avisos. |

Agregar o quitar archivos de `contenido/` y editar `config.json` se aplica sin reiniciar; un cambio
de configuración vale desde el siguiente llamado.

### `config.json`

| Clave | Por defecto | Qué hace |
|---|---|---|
| `repeticiones` | `1` | Veces que se dice «Turno N» (1 o 2). |
| `volumenVoz` | `1` | Volumen del aviso y la voz, de 0 a 1. |
| `volumenMusica` | `0.6` | Volumen de los videos, de 0 a 1. |
| `atenuacionMusica` | `0.15` | Factor al que baja la música durante un anuncio. |
| `segundosBanner` | `8` | Segundos por imagen en modo banner. |
| `pantallaPublica` | `null` | Id del display de la TV; `null` elige el primero que no es el principal. Los ids aparecen en `turnero.log`. |
| `recargaDiaria` | `"04:00"` | Hora de la recarga preventiva de la pantalla pública. |
| `mensajes` | 3 mensajes | Textos del ticker inferior de la TV. |

## Arranque automático (RNF-07)

No es código, es configuración de Windows en la PC de la cafetería: inicio de sesión automático,
tarea programada «al iniciar sesión» con reinicio si falla, plan de energía sin suspensión y horas
activas de Windows Update de 8:00 a 16:00. Detalle en [docs/arquitectura.md §10](docs/arquitectura.md).

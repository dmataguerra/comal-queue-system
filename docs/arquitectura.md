# Turnero El Comal — Arquitectura

## Implementación vigente (0.3.1)

The current implementation is documented in [Current desktop architecture](current-architecture.md). The topology B, WebSocket, and server sections below are historical proposals and do not describe the installed product.

En producción, `config.json`, `estado.json`, `turnero.log` y `contenido/` viven en `%APPDATA%/comal-local/datos` (o en `TURNERO_DATOS` para pruebas). `estado.json` y las modificaciones de configuración se publican por escritura temporal, sincronización y renombrado. La carpeta `contenido/` almacena videos, banners, 100 voces y el aviso. La pantalla pública solo recibe estado, inventario y configuración necesarios para mostrar turnos y multimedia; los diagnósticos completos se consultan únicamente en operador.

El operador accede a **Diagnósticos** desde el final de la lista de Ayuda; allí consulta persistencia, TV, audio, YouTube, disco y recuperación. El registro usa JSON por línea con hora ISO/local, nivel, componente, versión y sesión. Rota a 5 MB y retiene cinco archivos. Los mensajes idénticos se agrupan durante 30 segundos. El proveedor de diagnósticos tolera fallos individuales de disco, inventario y ventanas.

Al desconectar la TV, Windows dispara una nueva sincronización y la ventana pública se recrea al reconectar; nunca se mueve el formulario del operador a la TV. Un renderizador terminado se recarga. El audio local degradado se comunica al operador. Un fallo o falta de internet en YouTube activa el contenido local y la reconexión vuelve a intentar la fuente configurada. El estado persistido se restaura solo si pertenece a la jornada actual; se descartan anuncios anteriores para evitar repetirlos. Consulte [operación y recuperación](operacion-recuperacion.md) y [publicación](lista-publicacion.md).

**Límite actual:** los estados multimedia dependen de señales de los renderizadores; no hay acuse físico de que el sonido salió por las bocinas o de que el cliente vio la TV. La instalación, upgrade, rollback, HDMI y audio requieren prueba en el hardware real.

---

## Diseño histórico y propuestas (no implementadas salvo que el código vigente lo confirme)

> v0.2 · 14 sep 2026 — implementada la topología A sin base de datos; ver ADR-02 (§3.1) y §5.

---

## 1. Lo que quedó resuelto y qué implica

| Dato de la visita                              | Consecuencia en el diseño |
| El ticket tiene **6 dígitos**, pero solo cuentan **los dos últimos** (`213298` → turno `98`) | El dominio del sistema es un entero **00–99**. Toda la lógica trabaja con 2 dígitos. |
| Al pasar `99` vuelve a `00`                    | Es un contador módulo 100. No hay que validar orden ni continuidad (ya lo decía RN-02). |
| Lo llama **quien atiende la barra**, en un puesto **fijo** entre cocina y caja | Hay un lugar estable donde puede vivir un monitor de operador. Habilita la topología A (§2). |
| Horario **8:30 – 15:00**                       | La jornada **nunca cruza la medianoche**. El reinicio diario es una comparación de fecha calendario, sin casos raros. |

### Tres simplificaciones que esto regala

1. **La voz deja de ser un problema.** Con 2 dígitos hay exactamente 100 anuncios posibles. Se
   graban o generan **una sola vez** como 100 archivos de audio y se reproducen tal cual. La idea
   de concatenar («noventa» + «y ocho») que estaba en el pendiente 2 **ya no hace falta**: suena
   peor y es más código. RNF-01 queda cubierto con archivos estáticos.
2. **La validación es trivial.** Un entero de 0 a 99. No hay rangos por servicio, ni prefijos, ni
   checksums.
3. **El reinicio diario es una línea.** Si la fecha guardada no es la de hoy, se arranca vacío.

### Lo que sigue abierto

| Pendiente | Bloquea |
|---|---|
| Tamaño y ubicación de la TV, y si tiene bocinas | Nada del diseño. Ajusta tamaños de fuente (§10) y si hace falta una bocina externa. |
| Turnos en hora pico | Valida el límite de 5 de RF-05, y dice si el ciclo de 100 importa (§11, riesgo 4). |
| Qué música prefieren | Nada. El modo banner ya es el plan B. |
| **Distancia de la barra a la TV** ⚠️ | **Sí bloquea, pero solo la topología (§2).** Es una medición, no una decisión de diseño. |

---

## 2. Topología: dónde corre cada cosa

El pendiente 1 resolvió **quién** llama y que tiene un puesto fijo. Lo que no dice es si **la PC
puede estar en ese puesto**. En lugar de esperar esa respuesta, el diseño la convierte en un
detalle de configuración.

### Topología A — recomendada, sin red

```
        BARRA                                    PARED / SALA
   ┌──────────────────┐                      ┌──────────────────┐
   │  PC + monitor    │                      │        TV        │
   │  vista operador  │ ──── HDMI largo ───→ │ pantalla pública │
   │  [ 98 ] Enter    │                      │    98   + voz    │
   └──────────────────┘                      └──────────────────┘
        un solo proceso · dos ventanas · cero red
```

La PC vive en la barra con su propio monitor, y la TV es la **pantalla extendida** por HDMI. Un
solo proceso, dos ventanas, comunicación interna. Es la opción más simple y la más difícil de
romper: no hay red que se caiga.

**Lo que hay que verificar:** cable HDMI pasivo llega bien a ~10–15 m en 1080p. Más allá, cable
activo u óptico, o extensor HDMI por cable de red. Y que quepa un monitor pequeño en la barra.

### Topología B — respaldo, si la PC no puede estar en la barra

```
        BARRA                    PC (junto a la TV)              TV
   ┌──────────────┐          ┌────────────────────┐      ┌──────────────┐
   │   celular    │ ── Wi-Fi │  servidor local    │ HDMI │  pantalla    │
   │ vista oper.  │   local  │  + vista pública   │ ───→ │   pública    │
   └──────────────┘          └────────────────────┘      └──────────────┘
        Wi-Fi del local, sin internet
```

La pantalla pública sigue siendo una ventana de la misma aplicación. **Solo la vista del operador
se mueve** al navegador de un celular o tablet, por Wi-Fi local. Sigue cumpliendo RNF-01: no sale
tráfico a internet, solo a la red del local.

### La abstracción que hace que esto no sea un rediseño

```
        ┌──────────────────────────────────┐
        │  nucleo/    (funciones puras)    │   llamar() · deshacer() · normalizar()
        │  cero dependencias, cero efectos │
        └─────────────────┬────────────────┘
                          │
        ┌─────────────────▼────────────────┐
        │  Store                           │   despachar(accion)
        │  + persistencia en estado.json   │   suscribir(fn)
        └─────────────────┬────────────────┘
                          │   un solo contrato
             ┌────────────┴────────────┐
             │                         │
      adaptador IPC            adaptador WebSocket
      (topología A)               (topología B)
             │                         │
   ventana operador            celular del operador
   ventana pública             (la pública sigue en IPC)
```

Las vistas nunca hablan con el núcleo directamente: despachan acciones y reciben estado. Cambiar
de topología A a B **no toca el núcleo ni las vistas**, solo se enchufa otro adaptador. La
medición de la distancia deja de ser un bloqueo y pasa a ser un flag en `config.json`.

---

## 3. ADR-01 — Stack: Electron

**Decisión:** Electron (Chromium + Node) empaquetado como un `.exe` para Windows 11.

**Por qué**

| Requerimiento | Qué lo cubre en Electron |
|---|---|
| RF-13 · dos vistas, una en la TV | `screen.getAllDisplays()` + dos `BrowserWindow`, una en pantalla completa en el display secundario. Funcionalidad de primera clase. |
| RNF-05 · «bonito», Futura, banner animado | HTML y CSS. La identidad visual es dramáticamente más barata aquí que en XAML o WinForms. |
| RF-10, RF-11 · video y atenuación | `<video>` con decodificación por hardware, y `volume` por elemento: el *ducking* son dos líneas. |
| RNF-03 · menos de 1 s | Web Audio con los sonidos **ya decodificados en memoria**: el disparo es inmediato (§6). |
| RF-14 · carpeta de contenido | Node en el proceso principal: acceso a disco sin runtime extra. |
| RNF-09 · sin base de datos | Un `estado.json` escrito de forma atómica. |
| RNF-07 · arranca solo | Empaquetado a `.exe`, arranque por Task Scheduler, modo pantalla completa nativo. |
| Topología B | El mismo proceso puede levantar un servidor HTTP + WebSocket local, sin agregar tecnología. |

**Costo:** ~150 MB instalado y 250–400 MB de RAM. En una PC dedicada a esto es irrelevante, pero
**hay que confirmar que la PC de la cafetería tenga al menos 4 GB**.

**Alternativas consideradas**

- **Tauri** (Rust + WebView2). Empaquetado de ~5 MB y mucha menos RAM, y WebView2 ya viene en
  Windows 11. Se descarta por ahora porque el backend es Rust: la curva de aprendizaje no cabe en
  el calendario. **Se reconsidera si la RAM resulta ser un problema en la PC real** — y el núcleo
  puro hace que migrar sea viable.
- **Dos ventanas de Chrome en modo kiosco + servidor estático mínimo.** Es el camino más liviano y
  sin framework. Se descarta como opción principal porque colocar cada ventana en su display desde
  un `.bat` es frágil, y no hay forma limpia de *garantizar* que el campo de captura nunca aparezca
  en la TV (RF-13). Queda como plan de emergencia.
- **WPF / .NET.** Nativo, eficiente, el mejor manejo de multi-monitor. Se descarta por RNF-05: el
  trabajo de diseño se vuelve el cuello de botella, y tipografía, banner animado y atenuación de
  audio son todos más laboriosos.

**Lo que esta decisión no arriesga.** Toda la lógica de negocio vive en `nucleo/`, que es
JavaScript puro sin dependencias. Si el stack cambia, el núcleo y sus pruebas se llevan intactos.

### 3.1 ADR-02 — Implementación: TypeScript en todo y React en las vistas

**Decisión:** el núcleo y el proceso principal se escriben en TypeScript; las vistas se
construyen con React + Vite, reutilizando la identidad visual Troyanos que ya existía. Se
eliminan SQLite, NestJS y Socket.IO: el estado vive en el proceso principal y viaja por IPC.

**Por qué**

- El prototipo anterior ya tenía la interfaz pública y la del operador en React (paleta, vidrio,
  ticker, mascota). Reescribirlas en HTML plano costaba días sin cambiar ningún requerimiento.
- El contrato de §2 se cumple igual: las vistas solo reciben `Instantanea` y despachan `Accion`
  a través de `window.turnero` (`main/contrato.ts`). No importan el store ni tocan disco.
- TypeScript tipa ese contrato de punta a punta. `nucleo/turnos.ts` sigue sin dependencias ni
  efectos; se prueba con `node:test` a través de `tsx`.

**Diferencias con el texto original, a propósito**

| Decía | Quedó | Motivo |
|---|---|---|
| Vistas en HTML/CSS/JS plano | React + Vite, una página por ventana | Reuso del trabajo visual |
| `nucleo/` en JavaScript | TypeScript, cero dependencias | Contrato tipado; mismo espíritu |
| `voz/*.mp3` | `voz/*.wav` | Ya estaban generados y verificados |
| La elección de pantalla se recuerda en `config.json` | `pantallaPublica` la fija el administrador; la app no escribe `config.json` | Evita pisar ediciones y ciclos con el vigilante |
| Reinicio diario al arrancar | También al despachar y en la recarga de las 04:00 | Si la PC nunca se apaga, el estado de ayer sobreviviría |
| Franja superior (RF-08) | Ticker inferior | Ajuste visual pendiente de F5 |

**Topología B** sigue sin implementarse: un adaptador WebSocket implementaría la misma
interfaz `TurneroApi` sin tocar el núcleo ni las vistas.

---

## 4. El núcleo: una sola función

Toda la tabla de decisión de casos de uso §8 es **una función pura**. Sin ramas por caso de uso,
sin clases, sin estado oculto.

```js
// nucleo/turnos.js — sin dependencias, sin efectos secundarios

export const MAX_LLAMADOS = 5;                     // RF-05

export const ESTADO_INICIAL = { actual: null, llamados: [], deshacer: null };

/** "213298" -> 98 · "98" -> 98 · "8" -> 8 · inválido -> null */
export function normalizar(entrada) {
  const d = String(entrada ?? '').trim();
  if (!/^\d{1,6}$/.test(d)) return null;
  return Number(d.slice(-2));                      // solo los dos últimos dígitos
}

/** 8 -> "08" */
export function formatear(n) {
  return String(n).padStart(2, '0');
}

/** Única transición del sistema. Cubre CU-01, CU-02 y toda la tabla de decisión. */
export function llamar(estado, entrada, maxLlamados = MAX_LLAMADOS) {
  const n = normalizar(entrada);

  // CU-01 3a — captura inválida: la pantalla pública no se toca
  if (n === null) {
    return { estado, efecto: { tipo: 'CAPTURA_INVALIDA', entrada } };
  }

  // RN-05 / CU-01 3c — ya es el actual: solo se repite el anuncio
  if (estado.actual === n) {
    return { estado, efecto: { tipo: 'ANUNCIAR', n } };
  }

  // CU-01 pasos 4-5 + CU-02 paso 3, sin ramas:
  //   · filter saca N si estaba en la lista   -> RF-06 y RN-04
  //   · si actual es null no se agrega nada   -> CU-01 4a
  //   · slice recorta a 5                     -> RF-05
  const llamados = [
    ...(estado.actual === null ? [] : [estado.actual]),
    ...estado.llamados.filter((x) => x !== n),
  ].slice(0, maxLlamados);

  return {
    estado: {
      actual: n,
      llamados,
      deshacer: { actual: estado.actual, llamados: estado.llamados },
    },
    efecto: { tipo: 'ANUNCIAR', n },
  };
}

/** CU-03 — un solo nivel, y silencioso */
export function deshacer(estado) {
  if (!estado.deshacer) return { estado, efecto: null };          // CU-03 1a
  return { estado: { ...estado.deshacer, deshacer: null },        // CU-03 2a
           efecto: null };                                        // CU-03 paso 3
}
```

### Por qué no hay un `if` por caso de uso

«Número nuevo» y «número que está en la lista» parecen dos comportamientos distintos, pero son la
misma expresión: *pon el actual arriba, quita N de la lista si estaba, recorta a 5*. Cuando N no
estaba, el `filter` no hace nada y el `slice` tira al más viejo. Cuando sí estaba, el `filter` lo
saca y el `slice` no tiene nada que tirar.

Esa es la razón de fondo por la que CU-01 y CU-02 son la misma tecla para el operador: **también
son la misma operación por dentro.** La decisión de diseño de casos de uso §8 y la implementación
coinciden, en lugar de ser una traducción.

### Pruebas

`nucleo/` no tiene dependencias, así que se prueba con `node --test`, sin framework. La suite es
exactamente la tabla de decisión más el deshacer:

```
llamar()
  ✓ número nuevo: pasa a actual, el anterior entra arriba, el 6.º saca al más viejo
  ✓ número en la lista: sale de la lista y no se duplica          (RF-06, RN-04)
  ✓ número que ya es el actual: no cambia el estado, solo anuncia (RN-05)
  ✓ número que ya salió de la lista: se comporta como nuevo
  ✓ vacío, letras, 7 dígitos: CAPTURA_INVALIDA y estado intacto   (CU-01 3a)
  ✓ primer llamado de la jornada: la lista queda vacía            (CU-01 4a)
  ✓ 6 dígitos: usa los dos últimos                                (pendiente 2)
  ✓ un dígito: se interpreta con cero a la izquierda
deshacer()
  ✓ restaura el estado previo y no anuncia
  ✓ sin llamado previo: no hace nada                              (CU-03 1a)
  ✓ dos veces seguidas: el segundo no hace nada                   (CU-03 2a)
```

Once pruebas cubren las 5 reglas de negocio y los tres casos de uso del operador. Es el
entregable de pruebas más barato posible, y es real.

---

## 5. Estructura del proyecto

Estructura implementada (ADR-02):

```
turnero/
├── docs/
│   ├── casos-de-uso.md
│   └── arquitectura.md
├── nucleo/                    ← lógica de negocio, TypeScript sin dependencias
│   ├── turnos.ts
│   └── turnos.test.ts            las 11 pruebas de §4
├── main/                      ← proceso principal de Electron
│   ├── main.ts                   arranque, protocolo turnero://, recarga de las 04:00
│   ├── ventanas.ts               displays, pantalla completa, RF-13
│   ├── store.ts                  despachar/suscribir, envuelve el núcleo
│   ├── persistencia.ts           estado.json atómico, reinicio diario
│   ├── config.ts                 lee, valida y vigila config.json
│   ├── contenido.ts              inventario y vigilancia de la carpeta de contenido
│   ├── contrato.ts               tipos compartidos con las vistas (TurneroApi)
│   ├── adaptador-ipc.ts          topología A
│   ├── preload.cts               expone window.turnero
│   ├── log.ts                    turnero.log
│   └── *.test.ts                 persistencia, store, config y contenido
├── vistas/                    ← React + Vite, una página por ventana
│   ├── operador/                 RF-01, RF-07, RF-16, RF-17
│   ├── publica/                  RF-02, RF-05, RF-08 a RF-12
│   │   ├── Contenido.tsx            video y banner
│   │   ├── useAnuncios.ts           secuenciador de audio
│   │   └── audio.ts                 AudioBuffers precargados
│   └── comun/                    componentes, estilos, proveedor useTurnero
├── public/assets/             ← logos y mascota (RF-08)
├── contenido/                 ← EDITABLE POR EL ADMINISTRADOR (RF-14)
│   ├── videos/                   *.mp4 *.webm
│   ├── banner/                   *.jpg *.png *.webp
│   ├── voz/                      00.wav … 99.wav
│   └── aviso.wav
├── config.json                ← RF-15, se crea con valores por defecto si falta
└── estado.json                ← generado, RNF-09
```

`contenido/`, `config.json` y `estado.json` viven **fuera de la instalación**, en
`%APPDATA%\comal-local\datos`, para que el administrador pueda tocarlos sin reinstalar nada. No van
junto al `.exe`: el desinstalador de NSIS borra esa carpeta en cada actualización, y si se
instala en Program Files no se puede escribir ahí. El instalador deja el contenido de fábrica
junto al `.exe` y la app lo copia a su carpeta de datos en el primer arranque; la app crea `config.json`
si falta. Así una actualización nunca pisa lo que el administrador editó.

---

## 6. El camino crítico: del Enter a la pantalla

RNF-03 pide menos de 1 segundo. Se cumple por construcción:

| Momento | Qué pasa | Costo |
|---|---|---|
| `0 ms` | `normalizar()` + `llamar()` en memoria | microsegundos |
| `~1 ms` | el store despacha el estado nuevo a las dos ventanas por IPC | ~1 ms |
| `~17 ms` | la pantalla pública repinta el número | 1 cuadro |
| `~20 ms` | suena el *tin-tin* desde un buffer **ya decodificado** | inmediato |

**La única restricción de diseño que esto impone:** todo el audio se precarga y se decodifica al
arrancar. 100 archivos de voz más el aviso son unos 2–3 MB; se cargan una vez en `AudioBuffer`s y
nunca se lee disco en el camino crítico. Cargar el audio por demanda es lo único que rompería
RNF-03.

**Lo que no gatilla RNF-03:** el anuncio completo dura unos 4 segundos. El requerimiento es que el
número **aparezca** con sonido en menos de 1 s, no que termine de hablar. Son cosas distintas y
conviene que quede escrito para la entrega.

---

## 7. Audio: 100 archivos y nada más

```
contenido/voz/00.mp3 … 99.mp3     «Turno cero ocho» … «Turno noventa y nueve»
contenido/aviso.mp3               el tin-tin
```

**Secuencia de un anuncio** (RF-03, RF-11):

```
atenuar música (150 ms)
  → aviso.mp3
  → voz[n].mp3
  → [ si repeticiones = 2 ]  pausa 300 ms  →  voz[n].mp3
  → restaurar música (400 ms)
```

**Si llega un llamado nuevo a media secuencia** — pasa en hora pico — se cancela la secuencia en
curso, se **mantiene** la música atenuada y arranca la nueva. Sin cortes raros de volumen y sin
dos voces encimadas.

**Cómo se producen los 100 archivos.** Dos caminos, los dos cumplen RNF-01 porque quedan como
archivos estáticos: grabarlos con una persona (100 frases cortas, una sesión), o generarlos una
vez con una buena voz sintética. Recomiendo lo segundo por consistencia de volumen y entonación,
y porque se regeneran en minutos si cambian el texto.

Frases completas, **no** concatenación. «Noventa» + «y ocho» pegados suenan a robot y agregan
código para nada: con 2 dígitos el catálogo entero son 100 archivos.

---

## 8. Video y modo banner

### Selección (RF-10, CU-04)

Bolsa aleatoria en lugar de azar puro: se mezcla la lista completa, se reproduce entera, se vuelve
a mezclar. Evita que el mismo video salga tres veces en veinte minutos, y cumple «sin repetir el
que acaba de terminar» sin ningún caso especial.

### Atenuación (RF-11)

El elemento `<video>` tiene su propio `volume`. Atenuar es interpolarlo de `volumenMusica` a
`volumenMusica × atenuacionMusica` en 150 ms, y restaurarlo en 400 ms. No hace falta Web Audio
para esto.

### Estabilidad en jornada completa (RNF-06)

Este es el requerimiento que más fácil se rompe, y no por la lógica sino por el reproductor.
Cuatro medidas concretas:

1. **Un `<video>` nuevo por clip.** Al terminar, el anterior se pausa, se le quita el `src`, se
   llama `load()` y se saca del DOM. Reusar un solo elemento y cambiarle el `src` es el patrón
   clásico de fuga de memoria en Chromium para cartelería.
2. **Precargar el siguiente clip** en un elemento oculto unos 5 s antes del final, para que la
   transición no muestre negro.
3. **Un solo `setInterval`** para el reloj de la franja superior, creado una vez. Nunca anidado.
4. **Recarga programada de la ventana pública** a una hora configurable, por defecto **04:00** —
   fuera del horario de servicio de 8:30 a 15:00, así que es invisible. El estado está persistido,
   así que recargar no pierde nada. Es un seguro barato contra cualquier fuga que se nos escape.

La prueba de aceptación de RNF-06 es literal: dejar la aplicación corriendo con video en bucle
**una jornada completa** y mirar el consumo de memoria al principio y al final.

---

## 9. Persistencia sin base de datos (RNF-09)

```json
{
  "fecha": "2026-09-11",
  "actual": 98,
  "llamados": [43, 51, 38, 45, 40],
  "guardadoEn": "2026-09-11T13:42:07.331Z"
}
```

- **Escritura atómica** en cada cambio de estado: se escribe a `estado.json.tmp` y se renombra
  sobre `estado.json`. El renombrado en el mismo volumen es atómico, así que un corte de luz a
  media escritura no deja el archivo corrupto.
- **Al arrancar:** si `fecha` no es la de hoy, se arranca con `ESTADO_INICIAL` (CU-05 paso 4). El
  horario de 8:30 a 15:00 garantiza que la jornada no cruza la medianoche, así que comparar la
  fecha calendario es suficiente y no tiene casos borde.
- **`deshacer` no se persiste.** Es de la sesión. Después de un corte de luz no quieres poder
  deshacer hacia un estado anterior al corte.
- **Si la PC no se apaga en la noche**, la fecha también se revisa en cada despacho y en la
  recarga de las 04:00: el primer llamado del día siguiente arranca de cero (ADR-02).

Esto satisface a la vez «sin base de datos» y «que el estado sobreviva a una recarga»: un archivo
de texto de una línea, sin motor, sin esquema, sin instalación.

---

## 10. Arranque, recuperación y legibilidad

### RNF-07 — arranca solo y se recupera

Cinco cosas, y **solo una es código**:

1. ⚠️ **Inicio de sesión automático de Windows.** Sin esto, después de un corte de luz la PC se
   queda en la pantalla de bloqueo y no arranca nada. Es la causa más probable de «no arrancó
   solo», y es una configuración de Windows, no del programa. **Hay que verificarlo en la PC real.**
2. **Tarea programada** «al iniciar sesión», con *reiniciar la tarea si falla* activado. Es mejor
   que un acceso directo en la carpeta de Inicio porque se auto-repara.
3. **Plan de energía:** nunca suspender, nunca apagar la pantalla, sin protector de pantalla.
4. **Horas activas de Windows Update** puestas de 8:00 a 16:00, para que no reinicie a media
   jornada.
5. **Asignación de pantalla:** al arrancar se enumeran los displays y la ventana pública va al que
   **no** es el primario, en pantalla completa. La elección se recuerda en `config.json`.

**Si solo hay un display conectado**, la vista del operador muestra un aviso y la aplicación
**no** pone el campo de captura en la TV. RF-13 es una garantía, no una preferencia: es mejor que
el operador vea un error que que el cliente vea el campo de captura.

### RNF-08 — que se lea de lejos

Regla práctica de cartelería: unos **25 mm de altura de dígito por cada 3 m** de distancia de
lectura cómoda. Si los clientes están a 6–8 m, hacen falta 50–67 mm.

En una TV de 43" la pantalla mide unos 95 × 53 cm, así que 67 mm es el **13% de la altura**. Con
solo dos dígitos, el número puede ocupar tranquilamente el 35–45% de la altura. **Con 2 dígitos la
legibilidad no es un riesgo de diseño** en ninguna TV de 32" o más a distancias realistas. Falta
la medición para confirmarlo, pero no hay nada que rediseñar.

Es, literalmente, el turnero de 7 segmentos del profesor: dos dígitos enormes.

---

## 11. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| 1 | ⚠️ **Windows no tiene inicio de sesión automático.** RNF-07 se cae y nadie se da cuenta hasta el primer corte de luz. | Verificarlo en la PC real antes de prometer el arranque automático. §10. |
| 2 | **La PC no puede estar en la barra.** | La abstracción de §2 convierte esto en un flag. Se mide la distancia y se decide topología. |
| 3 | **La PC de la cafetería es vieja** y Electron va lento con video. | Confirmar RAM ≥ 4 GB. Si no alcanza, Tauri o las dos ventanas de Chrome. El núcleo se lleva intacto. |
| 4 | **El ciclo de 100 se repite en una jornada.** Con más de ~100 tickets al día, el mismo par de dígitos sale dos veces. | En pantalla no hay problema: la ventana de 5 hace que RN-04 se siga cumpliendo siempre. La ambigüedad es humana y ya existe en el sistema de tickets actual, no la introduce el turnero. **El dato de hora pico dice si vale la pena mostrar 3 dígitos.** Por ahora no cambiaría nada. |
| 5 | **Los videos vienen en un códec que Chromium no reproduce** (MKV, VP9 raro). | Fijar el contrato: MP4 con H.264 y AAC. El inventario de `contenido.js` ignora y registra lo que no puede reproducir. |
| 6 | **La TV no tiene bocinas** o están apagadas. | Es la mitad del sistema (RF-03). Verificar en la visita; si no hay, una bocina USB o de 3.5 mm en la PC. |
| 7 | **Fuga de memoria del reproductor** en jornada larga. | Las cuatro medidas de §8, y la prueba de jornada completa como criterio de aceptación. |
| 8 | **Licencia de la música.** | Sigue abierto (pendiente 4 de casos de uso). El modo banner es el plan B y ya está especificado. |

---

## 12. Plan de implementación

| Fase | Qué se entrega | Requerimientos | Estimado |
|---|---|---|---|
| **F1** | `nucleo/` completo con sus 11 pruebas. Sin interfaz. | RN-01 a RN-05, CU-01, CU-02, CU-03 | 1–2 días |
| **F2** | Dos ventanas en dos displays, captura, número en la TV, *tin-tin*. | RF-01, RF-02, RF-04, RF-05, RF-06, RF-13, RNF-03 | 2–3 días |
| **F3** | Los 100 audios de voz, repeticiones, y persistencia. | RF-03, RF-07, RNF-09 | 2 días |
| **F4** | Video con bolsa aleatoria, atenuación, modo banner. | RF-10, RF-11, RF-12, CU-04 | 3 días |
| **F5** | Identidad visual final, configuración sin código, arranque automático, prueba de jornada completa. | RF-08, RF-09, RF-14, RF-15, RNF-05, RNF-06, RNF-07 | 3–4 días |
| **F6** | Manual de usuario y ayuda en la interfaz. | RF-16 | 1 día |

**F2 ya es demostrable ante el profesor**: se teclea un número y sale en la TV con sonido. Todo lo
demás es acabado.

**F5 depende de insumos externos** — paleta, tipografía y logos oficiales (RNF-05). Mientras no
lleguen, se trabaja con el sustituto de Futura y la paleta marino-cian, y se deja el color en
variables CSS para que el cambio sea de un archivo.

---

## 13. Hallazgos de la revisión de casos-de-uso.md

Cinco cosas que los pendientes resueltos dejan desalineadas en el documento de casos de uso:

1. **RF-01 quedó incompleto.** Ahora se puede escribir la validación real:
   > *El operador captura el número en un campo numérico y presiona Enter. Se aceptan de 1 a 6
   > dígitos y se usan los **dos últimos**; el dominio es 00–99.*

2. **RF-03 se simplifica y la nota del pendiente 2 quedó obsoleta.** Con 2 dígitos son 100
   archivos completos. Conviene borrar la idea de la concatenación para que nadie la implemente
   por error.

3. **Falta un requerimiento que cae de este análisis — propongo RF-17:**
   > *La vista del operador muestra, antes de confirmar, los dos dígitos que se van a anunciar.*
   
   Esto es lo que hace que aceptar 6 dígitos sea **seguro** en lugar de peligroso. Si el operador
   teclea `981` por error de transposición, ve `81` antes de presionar Enter, en vez de descubrirlo
   cuando ya salió en la TV. Es la primera línea de defensa; CU-03 es la segunda.

4. **CU-05 paso 4 ya es implementable sin ambigüedad.** Con horario de 8:30 a 15:00 el reinicio
   diario es una comparación de fecha calendario. Vale anotarlo en el caso de uso.

5. **Inconsistencias menores de formato.** §10 ya no tiene Pendiente 4, pero §11 lo sigue citando.
   Y varias tablas perdieron su fila separadora `|---|---|` en las ediciones a mano, incluida la de
   Actores, que además tiene una celda partida en dos líneas: en Markdown esas tablas no se
   renderizan como tabla. Conviene arreglarlo antes de entregarlo al profesor.

Ninguno de los cinco bloquea empezar F1: el núcleo no depende de esas redacciones.

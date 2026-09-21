# Recursos de audio locales

Los audios ya se incluyen en `contenido/`. No hace falta descargar ni instalar un sintetizador para
usar el turnero: se generan una sola vez y la aplicación reproduce los archivos tal cual (RNF-01).

## Anuncios

- `contenido/voz/00.wav` a `99.wav`: «Turno cero cero» a «Turno noventa y nueve». El catálogo está
  completo; ningún número queda sin voz.
- `contenido/aviso.wav`: el *tin-tin* que precede a cada anuncio.
- Formato: WAV PCM, 16 bits, 22 050 Hz, mono.
- Secuencia en la pantalla pública: aviso → voz → (pausa de 300 ms → voz, si `repeticiones` es 2).

Las voces son sintéticas, español mexicano neutro, generadas con
[Piper](https://github.com/OHF-Voice/piper1-gpl) y la voz `es_MX-claude-high` (VITS neuronal,
22 050 Hz). No es una grabación humana, pero sí una voz neuronal: entonación y ritmo naturales, muy
lejos del timbre robótico de un sintetizador por formantes.

## Regenerar con Piper

Genera los 100 archivos (00–99) en `contenido/voz`. En Windows con PowerShell 7 y Python 3:

```powershell
pwsh -ExecutionPolicy Bypass -File tooling/audio/generate-announcements.ps1
```

La primera corrida necesita internet: crea un entorno virtual en `.tmp-audio/`, instala
`piper-tts` y descarga la voz (63 MB). Las siguientes reutilizan todo y tardan unos 17 segundos.
Nada de esto toca Windows ni entra al instalador: `.tmp-audio/` está en `.gitignore` y lo único que
se distribuye son los WAV.

### Parámetros

| Parámetro | Por defecto | Para qué |
| --- | --- | --- |
| `-Voice` | `es_MX-claude-high` | Otra voz de Piper, p. ej. `es_AR-daniela-high` o `es_ES-davefx-medium`. |
| `-LengthScale` | `1.0` | Alarga la frase si la sala es ruidosa. Es sublineal: `1.2` da ~7 % más, no 20 %. |
| `-Volume` | `1.2` | Iguala la sonoridad del catálogo anterior y deja ~3 dB de headroom. |
| `-Python` | `python` del PATH | Intérprete con el que se crea el entorno virtual. |

Conviene comparar voces **en la bocina real del local**, no con audífonos: en una sala con ruido
una voz más suave puede entenderse peor que una más plana.

### Por qué esos ajustes

`synthesize.py` carga el modelo una sola vez y sintetiza las 100 frases de corrido; invocar el CLI
una vez por frase costaría ~4 s de carga cada vez (6,6 min contra 17 s).

Dos ajustes no son los de fábrica, y conviene no revertirlos sin medir:

- **`noise_w_scale = 0`.** La voz viene con `0.8`, que sacude el ancho de cada fonema: la misma
  frase sale 3–4 % más larga o más corta en cada corrida. En 0 las duraciones son exactas y
  reproducibles, así que los 100 clips suenan a una sola sesión y no a 100 tomas distintas.
- **`normalize_audio = false`.** El normalizador de Piper lleva cada clip a fondo de escala: recorta
  en bocinas baratas y ata el volumen de la frase a su fonema más fuerte. La salida cruda ya viene
  pareja entre clips (dispersión de 2,7 dB) y conserva headroom.

## Regenerar con Azure Speech

Las voces neuronales de Azure (`es-MX-DaliaNeural`, `es-MX-JorgeNeural`) suenan bastante más
naturales que Piper. Como Piper, se usan **solo en tiempo de compilación**: se generan los 100 WAV
una vez, se versionan, y la aplicación instalada sigue sin internet ni dependencias (RNF-01). La
clave vive en el entorno; no entra al repositorio ni al instalador.

### Sacar la clave

1. Entra a [portal.azure.com](https://portal.azure.com) con una cuenta Microsoft.
2. **Crear un recurso** → busca **Speech** → *Crear*.
3. Rellena: suscripción, un grupo de recursos nuevo, región (**East US** sirve; lo que importa es
   usar la misma después en `AZURE_SPEECH_REGION`) y plan de tarifa **F0**, el gratuito.
4. Al terminar el despliegue: **Ir al recurso** → *Claves y punto de conexión* → copia **KEY 1** y
   la **Ubicación/Región**.

F0 da 500 000 caracteres de voz neuronal al mes. El catálogo completo son ~2 000, así que
regenerarlo entra de sobra aunque pruebes varias voces. El límite que sí se nota es el de 20
peticiones por minuto: el script espera 3,1 s entre una y otra, y los 100 clips tardan ~5 minutos.

### Generar

```powershell
$env:AZURE_SPEECH_KEY = 'la-clave-que-copiaste'
$env:AZURE_SPEECH_REGION = 'eastus'

node tooling/audio/generate-azure.mjs --muestra   # 6 clips de prueba; no toca el catálogo
node tooling/audio/generate-azure.mjs             # los 100 en contenido/voz
node tooling/audio/verify-audio.mjs
```

`--muestra` escribe en `.tmp-audio/cmp/G-azure/`, al lado de las variantes de Piper, para comparar
antes de reemplazar nada.

| Parámetro | Por defecto | Para qué |
| --- | --- | --- |
| `--voice` | `es-MX-DaliaNeural` | Otra voz. En es-MX también: `es-MX-JorgeNeural`, `es-MX-RenataNeural`, `es-MX-CecilioNeural`, `es-MX-NuriaNeural`. |
| `--rate` | `-5%` | Velocidad. `0%` es la de fábrica; más lento se entiende mejor con ruido. |
| `--delay` | `3100` | Milisegundos entre peticiones, para no rozar la cuota de F0. Con un recurso de pago (S0) se puede poner `0`. |
| `--target-rms` | `0.107` | Sonoridad del catálogo: es el RMS medio de la tanda de Piper, así que `volumenVoz` sigue valiendo lo mismo. |
| `--sin-normalizar` | — | Deja la sonoridad cruda de Azure. |
| `--output-dir` | según `--muestra` | Carpeta de salida. |

Dos detalles que conviene no revertir:

- **Una sola ganancia para todo el catálogo**, no una por clip. Igualar clip por clip ata el
  volumen de cada frase a su fonema más fuerte, que es justo lo que se evita al desactivar el
  normalizador de Piper. La ganancia se recorta si algún clip fuera a pasar de 0,97 de pico.
- **La cabecera se reescribe.** Azure transmite la respuesta con los tamaños de RIFF y `data` en
  marcador, que no corresponden al cuerpo real; guardar el WAV tal cual haría fallar
  `verify-audio.mjs`.

## Aviso y verificación

```powershell
node tooling/audio/generate-aviso.mjs
node tooling/audio/verify-audio.mjs
```

El aviso es una síntesis determinista de dos campanas, sin muestras externas. El verificador revisa
las 100 voces y el aviso: cabecera RIFF/WAVE íntegra, PCM de 16 bits, duración, muestras no nulas y
volumen RMS.

## Licencias

El motor, [Piper 1.8.0](https://github.com/OHF-Voice/piper1-gpl), es GPL-3.0 (embebe eSpeak NG para
la fonemización). Se usa **solo en tiempo de compilación**: no se distribuye con la aplicación, así
que la copyleft no alcanza al turnero. Lo mismo valía para el eSpeak NG que se usaba antes.

La voz `es_MX-claude-high` es **Apache-2.0**
([model card](https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_MX/claude/high/MODEL_CARD)),
que es la razón de haberla elegido sobre `es_AR-daniela-high`: esa suena muy bien, pero su dataset
es CC-BY-SA 4.0 y arrastra obligaciones de atribución y *share-alike* sobre el audio generado.

El audio sintetizado con **Azure Speech** se puede usar en productos, también en el plan gratuito
F0; lo que los términos prohíben es hacerse pasar por una persona real y usar la salida para
entrenar otro modelo de voz. Ninguna de las dos cosas aplica aquí. Como con Piper, el servicio se
consume solo al compilar: no se distribuye nada de Microsoft con el turnero.

Los WAV son salida sintetizada de frases originales de este proyecto.

# Recursos de audio locales

Los audios ya se incluyen en `contenido/`. No hace falta descargar ni instalar un sintetizador para
usar el turnero: se generan una sola vez y la aplicación reproduce los archivos tal cual (RNF-01).

## Anuncios

- `contenido/voz/01.wav` a `99.wav`: «Turno uno» a «Turno noventa y nueve».
- `contenido/voz/00.wav`: **pendiente**. Mientras falte, el turno 00 suena solo con el aviso y queda
  registrado en `turnero.log`.
- `contenido/aviso.wav`: el *tin-tin* que precede a cada anuncio.
- Formato: WAV PCM, 16 bits, 22 050 Hz, mono.
- Secuencia en la pantalla pública: aviso → voz → (pausa de 300 ms → voz, si `repeticiones` es 2).

Las voces son sintéticas, español latinoamericano `es-419`, eSpeak NG 1.52.0, velocidad 145,
tono 45. Es una voz de demostración audible, no una grabación humana.

## Regenerar las voces

Genera los 100 archivos (00–99) en `contenido/voz`. En Windows con PowerShell 7 y eSpeak NG ya
instalado:

```powershell
pwsh -ExecutionPolicy Bypass -File tooling/audio/generate-announcements.ps1 -EspeakPath 'C:\ruta\espeak-ng.exe'
```

`-PrepareEngine` descarga **solo para regenerar** el paquete oficial fijado en 1.52.0, verifica su
SHA-256 y lo extrae con 7-Zip a `.tmp-audio/`. No instala software ni modifica las voces de Windows.
La descarga requiere internet; los WAV generados y la aplicación funcionan sin él.

Fuente del sintetizador: [eSpeak NG, versión 1.52.0](https://github.com/espeak-ng/espeak-ng/releases/tag/1.52.0).
El generador se distribuye bajo GPL-3.0-or-later y sus binarios no se incluyen en la aplicación.
Los WAV son salida sintetizada de frases originales de este proyecto.

## Aviso y verificación

```powershell
node tooling/audio/generate-aviso.mjs
node tooling/audio/verify-audio.mjs
```

El aviso es una síntesis determinista de dos campanas, sin muestras externas. El verificador revisa
las voces 01–99 (y la 00 si existe) y el aviso: cabecera RIFF/WAVE íntegra, PCM de 16 bits,
duración, muestras no nulas y volumen RMS.

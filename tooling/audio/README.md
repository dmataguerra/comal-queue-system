# Recursos de audio locales

Los audios ya se incluyen en el proyecto. No hace falta descargar ni instalar un sintetizador al ejecutar el sistema.

## Llamados

- `public/audio/turns/01.wav` a `99.wav`: «Turno uno» a «Turno noventa y nueve».
- `public/audio/counters/1.wav` y `2.wav`: «Favor de pasar al mostrador uno/dos».
- `public/audio/ready.wav`: «Su pedido está listo», para un turno sin mostrador.
- Formato: WAV PCM, 16 bits, 22 050 Hz, mono. Reproducir el turno seguido por el sufijo correspondiente.
- Voz sintética española latinoamericana `es-419`, eSpeak NG 1.52.0, velocidad 145, tono 45. Es una voz de demostración audible, no una grabación humana.

Generación reproducible en Windows con PowerShell 7 y una instalación existente de eSpeak NG:

```powershell
pwsh -ExecutionPolicy Bypass -File tooling/audio/generate-announcements.ps1 -EspeakPath 'C:\ruta\espeak-ng.exe'
```

También se puede ejecutar `-PrepareEngine`: descarga **solo para regeneración** el paquete oficial fijado a 1.52.0, verifica SHA-256 y lo extrae con 7-Zip a `.tmp-audio/`; no instala software ni modifica las voces de Windows. La descarga requiere internet; los WAV generados y la aplicación funcionan sin él.

Fuente del sintetizador: [eSpeak NG, versión 1.52.0](https://github.com/espeak-ng/espeak-ng/releases/tag/1.52.0). El generador se distribuye bajo GPL-3.0-or-later; sus binarios no se incluyen en los assets de la aplicación. Los WAV son salida sintetizada de frases originales de este proyecto.

## Música de demostración

`data/music/lo-fi/`, `data/music/jazz/` y `data/music/rock/` contienen dos piezas breves por género. Son composiciones instrumentales originales generadas por código, sin samples ni descargas de grabaciones. Sus nombres terminan en `-demo.wav`; no son catálogos comerciales de 24/18/27 pistas.

```powershell
node tooling/audio/generate-demo-music.mjs
node tooling/audio/verify-audio.mjs
```

El verificador comprueba los 99 códigos, los tres sufijos y seis pistas: cabecera RIFF/WAVE íntegra, PCM de 16 bits, duración, muestras no nulas y volumen RMS. La audición y la autorización de reproducción del navegador se comprueban en la pantalla pública.

# Comal++ 0.3.1 — Instalación en la computadora del restaurante

## Contenido de esta USB

- `Comal++ Setup 0.3.1.exe`: instalador de la aplicación.
- `SHA256.txt`: huella digital del instalador para comprobar que no se dañó durante la copia.

## Antes de instalar

1. Cierra Comal++ por completo.
2. Abre el Administrador de tareas y confirma que no quede un proceso de Comal++ o Electron relacionado.
3. Realiza una copia de seguridad de la carpeta de datos actual. No la borres antes de tener el respaldo.
4. Si es posible, anota la versión instalada, el volumen, la configuración de la TV y las bocinas.

## Comprobar el instalador

La comprobación del hash es recomendable, aunque no es indispensable para ejecutar el instalador.

1. Abre PowerShell.
2. Cambia `E:` por la letra asignada a esta USB.
3. Ejecuta:

```powershell
Get-FileHash "E:\INSTALADOR_FINAL\Comal++ Setup 0.3.1.exe" -Algorithm SHA256
```

Compara el resultado con el valor guardado en `SHA256.txt`. Ambos deben coincidir exactamente.

Si no coinciden, no instales el archivo. Copia nuevamente el instalador desde la fuente original.

## Instalar o actualizar

1. Ejecuta `Comal++ Setup 0.3.1.exe`.
2. Comprueba la identidad del firmante y el hash entregado. Para distribución de producción se exige firma válida; si Windows muestra «Editor desconocido», consulta al responsable para verificar el artefacto y su estado de aceptación antes de continuar. Un instalador unsigned de pruebas no acredita una publicación aprobada.
3. Sigue el asistente de instalación.
4. Conserva la carpeta de datos existente cuando se trate de una actualización.
5. Abre Comal++ al finalizar.

## Verificación inicial

Confirma que:

- La aplicación abre sin mostrar un error.
- El operador y la pantalla pública están disponibles.
- La TV está configurada como pantalla extendida.
- El audio sale por las bocinas correctas.
- Se muestran las imágenes de Multimedia.
- La configuración anterior se conserva cuando corresponde.

## Prueba obligatoria de turnos

Llama los números `00`, `01`, `09`, `40`, `55`, `66` y `99`.

Para cada número verifica que:

- Aparezca en el operador.
- Aparezca en la TV.
- Se escuche completo.
- Se marque como anunciado.
- Se pueda repetir.
- Se pueda corregir.
- Se pueda eliminar.

## Prueba obligatoria de volumen

Con un video local reproduciéndose, llama un turno y confirma este orden:

```text
Multimedia normal
→ multimedia atenuada
→ timbre completo
→ número completo
→ multimedia restaurada
```

El número no debe comenzar mientras la multimedia todavía está a volumen normal ni debe bajar a mitad del anuncio.

Repite la prueba con:

- Dos llamados consecutivos.
- Multimedia pausada.
- Cambio de video.
- Bocinas desconectadas y reconectadas.
- Aplicación cerrada y abierta nuevamente.

## Comprobar las imágenes

La versión de fábrica contiene 42 imágenes de banner. Verifica que aparezcan en el apartado Multimedia.

Si después de actualizar solo aparecen dos:

1. No borres la carpeta de datos.
2. Abre la carpeta de contenido desde la aplicación.
3. Cuenta los archivos existentes en la carpeta `banner`.
4. Conserva una copia de esa carpeta antes de modificarla.

Una actualización conserva la carpeta de datos existente para no borrar contenido personalizado. Por eso una instalación anterior puede conservar menos imágenes que el instalador nuevo.

## Prueba sin internet

Desconecta temporalmente la red y confirma que:

- Se puede llamar un turno.
- La pantalla pública funciona.
- El aviso y las voces locales se reproducen.
- El sistema no queda bloqueado.

YouTube requiere conexión a internet y puede no funcionar sin red. Para una operación estable, se recomienda utilizar contenido local.

## Si aparece un problema

No borres datos ni reinstales inmediatamente. Guarda:

- Captura del mensaje.
- Hora del incidente.
- Número de turno.
- Si se utilizaba video local o YouTube.
- Estado de la TV, bocinas y red.
- Carpeta de datos.
- Archivo `turnero.log`.

Si la aplicación no inicia o el audio no funciona, cierra la aplicación, conserva el respaldo y vuelve temporalmente a la versión anterior usando su instalador.

## Después de la instalación

Reinicia Comal++ y confirma nuevamente:

- Operador.
- TV.
- Audio.
- Imágenes.
- Llamados `00`, `40` y `99`.

No retires la USB hasta comprobar que la aplicación opera correctamente. Conserva una copia del instalador y del respaldo fuera de la computadora del restaurante.


## Controles e incidencias de la versión vigente

[El manual del operador](docs/user-manual/operador.md) explica captura de 1–6 dígitos y últimos dos (incluido 00), seis turnos visibles, vigencia de cinco minutos y cola de seis anuncios. Ayuda está en el encabezado o F1, con Diagnósticos al final. El tamaño ofrece 70–130%, ambos relojes usan am/pm y los avisos se despliegan desde una franja compacta. Cola llena o guardado fallido no aceptan la llamada: conserva el ticket y reintenta tras resolver la causa.

Después de instalar prueba la TV, la voz y contenido local. YouTube solo está admitido en escritorio y requiere internet. Al actualizar, conserva el respaldo anterior: una firma o hash correctos no sustituyen aceptación en la PC, TV y bocinas reales.

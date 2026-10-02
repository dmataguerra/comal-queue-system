# Manual del operador · Comal++ 0.4.0

Actualizado el 1 de octubre de 2026. Incluye los cambios coordinados con la sesión de implementación.

## 1. Antes de atender

Comal++ anuncia pedidos listos. El cobro, la preparación y el ticket se hacen en otro sistema. Se opera en una PC Windows; los turnos, voces y archivos locales funcionan sin internet.

1. Enciende TV y bocinas. Configura Windows para **Extender estas pantallas** y elige la salida de audio correcta.
2. Abre Comal++. La pantalla pública aparece en la TV en pantalla completa; sin segunda pantalla se abre como ventana normal en el monitor principal.
3. Abre **Ayuda** en el encabezado o con **F1**. Al final selecciona **Ver estado y detalles técnicos** para abrir Diagnósticos.
4. Comprueba guardado, pantalla, audio y espacio. Llama un número de prueba acordado, escucha en las bocinas y retíralo antes de empezar.

Diagnósticos se actualiza cada diez segundos mientras está abierto. Sus rutas y detalles técnicos no aparecen en la TV. El acuse de audio confirma la reproducción por el programa; comprueba también el sonido físico.

## 2. Llamar un pedido listo

En **Turnos**, escribe de **uno a seis dígitos** del ticket y pulsa **Enter**. Solo se anuncian los dos últimos: `213298` se muestra como `98`; `8`, como `08`; un ticket terminado en `00` se muestra como `00`. Letras, signos, decimales y más de seis dígitos se rechazan sin cambiar la pantalla.

La aplicación guarda antes de confirmar la llamada. El número pasa al primer lugar de **En pantalla**, aparece su tarjeta pública y se reproduce el aviso y la voz. La multimedia baja durante el anuncio y luego recupera su volumen. La captura se limpia solo al aceptar la llamada.

Se muestran hasta **seis números recientes**: actual y cinco anteriores. Otro número distinto desplaza al más antiguo; el aviso indica cuál saldrá. Cada número desaparece **cinco minutos después de su última llamada**. Esta lista no es un registro de ventas o entregas.

## 3. Repetir, corregir y quitar

- **Repetir:** escribe el número y pulsa Enter o usa **Anunciar** en su fila. Repite el actual o mueve al primer lugar un número anterior sin duplicarlo. Su vigencia vuelve a contar cinco minutos.
- **Corregir última captura:** revierte el último cambio de llamada una sola vez, sin anunciar. No restaura números ya vencidos. **Ctrl+Z** solo edita el texto. Al reiniciar se pierde la corrección pendiente.
- **Quitar:** retira un número y elimina la corrección pendiente. No registra una entrega, cancelación o devolución. Descarta sus anuncios pendientes; el audio que ya empezó puede terminar.

**Anunciar** y **Quitar** piden confirmación. **No volver a mostrar durante esta sesión** aplica a ambas acciones; al reabrir la app se pedirá de nuevo.

## 4. Audio y avisos

La cola de audio admite **seis anuncios**, incluido el que suena. Repetir ocupa otro lugar. Desde cinco aparece un aviso; con seis, otra llamada se rechaza **sin cambiar el turno**. El ticket permanece en el campo: espera a que termine un anuncio y vuelve a pulsar Enter. El mensaje de espera no significa que la llamada esté aceptada.

Los avisos persistentes se agrupan en una franja compacta desplegable; ábrela para verlos todos. Los resultados breves aparecen junto a la captura o como notificación en Multimedia. Cada fila indica el resultado más reciente:

- **En espera:** no empezó.
- **Anunciando:** la vista pública reproduce el anuncio.
- **Anunciado:** el programa terminó la reproducción.
- **Falló el audio:** revisa archivo, volumen y salida, y vuelve a llamar.
- **No anunciado:** se descartó o venció; revisa si hace falta repetir.

Un anuncio puede esperar hasta 45 segundos para empezar y su tarea dura como máximo 30 segundos. Un fallo no elimina el turno guardado. Al recargar o reiniciar no se repite audio antiguo: vuelve a llamar manualmente si corresponde.

## 5. Volumen, tamaño, tema y ayuda

El encabezado permite ajustar por separado **voz** y **multimedia** y pulsar **Aplicar**. Voz permite 0–300%; por encima de 100% puede distorsionar. Multimedia permite 0–100%. Una voz en 0% no confirma anuncios correctos. La voz cambia en el siguiente anuncio.

Las lupas ofrecen **70%, 80%, 90%, 100%, 110%, 120% y 130%**. El selector **Azul/Morado** conserva un espacio fijo. El fondo de ondas tiene movimiento suave y respeta movimiento reducido. Ambos relojes muestran **12 horas con am/pm**.

Tema y tamaño se guardan por origen: las dos ventanas Electron comparten preferencias; las vistas del mismo navegador también. **Escritorio y navegador tienen preferencias independientes**. Estos ajustes no forman parte del respaldo JSON.

**Ayuda** está en el encabezado y **F1**, sin entrada redundante en sidebar. **Escape** cierra la ayuda y devuelve el foco a captura.

## 6. Multimedia

En **Multimedia**, agrega videos **MP4/WebM** e imágenes **JPG/JPEG/PNG/WebP**, revisa tarjetas y quita archivos con confirmación. El selector usa archivos de esta PC o una USB. Espera a que terminen de descargarse antes de importarlos.

En escritorio, YouTube disponible tiene prioridad; si falla, se usan videos locales, luego imágenes y finalmente bienvenida. YouTube necesita internet. **En navegador no está admitido**: se usa contenido local aunque el escritorio tenga un enlace.

Límites: **2 GB por video**, **25 MB por imagen**, y **512 MB libres después de copiar** cuando puede medirse el disco. Nombres repetidos crean copias numeradas sin sobrescribir. Los rechazos muestran motivos. Agregar imágenes no las hace aparecer mientras se reproduzcan videos o YouTube.

Consulta [requisitos multimedia](multimedia-requisitos.md). No hay selector de mostrador ni música por géneros en esta versión.

## 7. Problemas durante la jornada

- **Guardado fallido:** la llamada no se aplicó ni anunció. Conserva el ticket, revisa espacio/permisos en Diagnósticos y reintenta tras resolverlo.
- **TV desconectada:** revisa energía, HDMI y modo extendido. La vista vuelve cuando Windows detecta la TV; repite los anuncios que el cliente no pudo ver u oír.
- **Sin sonido:** revisa salida, bocinas, voz y archivos. Comprueba el acuse, corrige y repite. Dos vistas públicas abiertas a la vez pueden duplicar sonido.
- **YouTube falla:** usa contenido local; turnos y voces siguen sin internet.
- **Recuperación o jornada vacía inesperada:** revisa Diagnósticos y registro antes de continuar; conserva las copias diagnósticas.

Si una vista se bloquea, la app intenta recargarla; si no vuelve, reinicia y comprueba los números. Solo vuelven los guardados del día que no hayan vencido. No se recuperan audio pendiente ni deshacer. Al cambiar de día se limpia la lista.

## 8. Cierre, respaldo y actualización

Cierra Comal++ y comprueba que no siga ejecutándose antes de copiar/restaurar datos. La ruta efectiva está en Diagnósticos; normalmente es `%APPDATA%\comal-local\datos`. Desde 0.3.1 los nuevos guardados están fuera de Documentos/OneDrive; la migración conserva originales.

El responsable debe respaldar configuración, estado, contenido y registros. Sigue [operación y recuperación](../operacion-recuperacion.md) y [la guía USB](../../README-INSTALACION-USB.md). La utilidad necesita repositorio y dependencias; no es un botón del instalador.

Tras actualizar o restaurar, comprueba versión, turnos, multimedia, TV y voz antes de atender. Un respaldo de otro día no reabre turnos anteriores.

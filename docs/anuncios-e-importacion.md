# Anuncios e importación de multimedia

## Política de anuncios

Cada llamada tiene un ID creciente durante la sesión. Los acuses se validan por ID y número; repetir un número conserva ambas entregas. Un acuse tardío no puede modificar otro anuncio ni revertir un estado terminal. El historial en memoria conserva hasta 100 entregas, sin eliminar las activas. La fila del operador muestra la entrega con el ID más reciente de ese número.

Se admiten hasta seis anuncios entre el activo y los pendientes. Si la cola está llena, una nueva llamada se rechaza antes de guardar: ni el turno, ni el deshacer, ni el ID cambian. El operador conserva su captura y recibe un aviso breve para reintentar, sin el prefijo técnico de error de IPC; también aparece un aviso al acumular cinco anuncios. Los avisos persistentes se agrupan en una franja desplegable; el acuse por fila sigue indicando la llamada más reciente.

Un anuncio puede esperar hasta 45 segundos para iniciar, incluyendo la preparación de atenuación. Cada ejecución tiene un máximo de 30 segundos. Estos límites están definidos en `shared/politica-anuncios.ts`. El plazo de 45 segundos admite la ráfaga normal de seis tarjetas de al menos seis segundos, sin permitir retrasos de varios minutos. No es una estimación de latencia física por HDMI.

Los anuncios pendientes de un turno que se retira, vence o sale de la lista se descartan. No se reproducen más tarde aunque ese número vuelva a llamarse: la nueva llamada tiene otro ID. Una ejecución que ya recibió el estado `reproduciendo` puede terminar si el turno se retira, pero sigue sujeta al límite de duración. Los descartes se comunican como «No anunciado» y no se marcan como reproducción correcta. Los plazos del proceso principal liberan capacidad aunque una ventana deje de responder o se recargue.

La reproducción sigue siendo FIFO por ventana pública. Abrir una segunda vista pública de navegador además de Electron puede reproducir el mismo anuncio en ambas; estos cambios no incorporan elección de una única salida de audio entre ventanas.

## Importación

La selección, consulta de tamaño/espacio y copia de los archivos importados son asíncronas. IPC y las acciones del operador siguen disponibles mientras se copia desde una USB lenta. El archivo se copia primero a un temporal oculto dentro del destino, se comprueba su tamaño y solo entonces se publica. La publicación utiliza un enlace duro local, de forma que ni archivos existentes ni importaciones concurrentes se sobrescriben; después se retira el temporal. El destino debe admitir enlaces duros (por ejemplo, NTFS, habitual en el perfil de Windows); una unidad incompatible rechaza la importación conservando los archivos anteriores. La USB de origen no requiere esta capacidad.

Se conservan los límites de 2 GB por video, 25 MB por imagen y 512 MB de reserva de espacio cuando puede consultarse. Un fallo o una copia incompleta informa los motivos y limpia el temporal. La siembra de contenido de fábrica al arrancar no forma parte de este cambio.

## Validación y CI

`npm test` cubre acuses inválidos por HTTP, repetición y orden de IDs, rechazo sin mutación, plazos, descarte, historial acotado, copia lenta, nombres concurrentes y copias truncadas. `npm run test:hardening` comprueba IDs repetidos, el aviso de saturación, descarte y una acción IPC durante una importación retenida en datos aislados. Los smoke de interfaz/tema verifican ayuda, avisos, siete tamaños y reloj am/pm. Que una prueba exista no acredita un PASS del artefacto que se va a distribuir.

La prueba de navegador exige una reproducción confirmada por HTTP: desactiva el listener de acuse IPC solo dentro del test para impedir que la ventana Electron produzca un falso positivo.

Los workflows CI y release construyen el instalador de referencia 0.2.0 desde `7b10bb992fe43413262e56fd0ad3a67e6ebdf489` y su lockfile mediante `legacy-installer.yml`, lo transfieren entre jobs como artefacto y verifican SHA-256 antes de la prueba. Ese instalador histórico se utiliza exclusivamente como fixture de migración y reversión; no es el producto que se distribuye.

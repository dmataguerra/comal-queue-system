# Comal++ 0.4.0 · Notas de release

Preparación de versión: 1 de octubre de 2026. Esta versión reúne las mejoras de interfaz, reproducción, recuperación y documentación posteriores a 0.3.1. La integración en main no equivale a publicar un instalador validado.

## Cambios para el operador y la pantalla pública

- Ayuda disponible en el encabezado y con F1, sin navegación duplicada en la sidebar.
- Siete niveles de zoom: 70%, 80%, 90%, 100%, 110%, 120% y 130%.
- Relojes de 12 horas con am/pm en ambas interfaces.
- Selector Azul/Morado con espacio reservado para evitar desplazamientos del encabezado.
- Ondas de fondo más sutiles y continuas, respetando movimiento reducido.
- Avisos persistentes agrupados en una franja desplegable; mensajes de captura más cortos.
- Cola de audio llena con mensaje legible y ticket conservado para reintentar; el rechazo no cambia el turno.
- Capturas de más de seis dígitos rechazadas completas, sin truncar ni anunciar otro número.
- Mensajes de multimedia que describen el respaldo sin afirmar que un video defectuoso está reproduciéndose.

## Confiabilidad y recuperación

- Invalidación de caché cuando cambia el audio local y diagnóstico de voz silenciada o recursos faltantes.
- YouTube controlado en escritorio; el navegador local utiliza contenido local y comunica salud y registros por HTTP.
- Restauración con validación de configuración, estado, fechas y separación de rutas antes de reemplazar datos.
- Reintentos acotados de publicación de archivos en Windows.
- Pruebas de navegador aisladas en un puerto libre y con verificación de su propia carpeta de datos.
- Jornada de resistencia con reintentos limitados, comprobación de acuses, comparación entre TV/memoria/archivo y recuperación tras recarga sin repetir anuncios.
- Documentación técnica y manuales reconciliados con la aplicación vigente.

## Compatibilidad y actualización

Se conserva la operación local, la captura de uno a seis dígitos y los números 00–99. La pantalla muestra hasta seis turnos recientes, con vigencia de cinco minutos; la cola de audio admite seis anuncios incluido el activo. Los datos siguen en el perfil de la aplicación y se conserva la migración de versiones anteriores.

Antes de actualizar, cerrar la aplicación y respaldar los datos. Después, comprobar TV, voces, multimedia y guardado siguiendo [operación y recuperación](operacion-recuperacion.md). No sustituir el instalador publicado de una versión anterior ni mover su tag.

## Validación y condiciones de publicación

Las verificaciones locales de implementación aprobaron build, formato, lint, interfaz, zoom, tema, ondas, navegador, captura y multimedia. El preflight de jornada aprobó ocho anuncios, saturación sin mutación, entradas inválidas, corrección y recarga sin repetición. Estos resultados no sustituyen la CI del commit final ni la validación de un nuevo instalador 0.4.0.

Antes de crear el tag v0.4.0 y distribuir:

1. Aprobar la CI del PR final y las pruebas de instalación, actualización y recuperación.
2. Completar los 390 minutos reales en el equipo destino y comprobar sonido físico.
3. Configurar y verificar la identidad de firma aprobada, los secretos y el entorno production.
4. Validar el artefacto firmado final y conservar hashes y evidencia.

El tag v0.4.0 debe apuntar al commit validado de main y coincidir con package.json. Crear/subir ese tag activa el workflow de publicación. Estas notas no declaran completadas la jornada real, la firma ni la publicación.

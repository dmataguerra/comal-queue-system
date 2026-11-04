# Comal++ 1.0.0

Fecha de preparación: **4 de noviembre de 2026**. Primera entrega estable para la operación de El Comal en la Facultad de Informática de la UAQ.

## Versión y compatibilidad

Se adopta **1.0.0** para marcar el paso del desarrollo inicial `0.x` a una versión estable, siguiendo [Versionado Semántico](https://semver.org/lang/es/). Las próximas correcciones compatibles incrementarán el parche (`1.0.1`); las funciones compatibles, la versión menor (`1.1.0`); los cambios incompatibles del contrato soportado, la mayor (`2.0.0`).

El alcance estable comprende la operación de escritorio Windows x64: captura de tickets, anuncio de sus dos últimos dígitos, sincronización de la pantalla pública, reproducción de voces locales, configuración, persistencia y recuperación documentadas. Los contratos se describen en la [arquitectura vigente](current-architecture.md) y el [manual del operador](user-manual/operador.md).

La actualización conserva el formato JSON vigente y los datos existentes. La migración desde 0.2.0 continúa sujeta a las pruebas de actualización y reversión del repositorio. El formato del progreso de ayuda es independiente de la versión de la aplicación.

## Cambios desde 0.4.0

- Centro de ayuda integrado con búsqueda, recorridos informativos y manual PDF local.
- Manejo de errores HTTP, ajustes de contraste, dependencias y pruebas adicionales de seguridad y accesibilidad.
- Estabilización del smoke de escala: sincronización de viewport, fuentes y geometría de los elementos hijos, con diagnósticos específicos.
- README renovado en español con el casco troyano, iconos de tecnologías en pixel art, capturas reales y demostración de ambas ventanas.
- Contacto actualizado y acceso directo a guías y documentos del proyecto.

Los cambios del candidato no publicado 0.4.1 se incorporan a esta versión. Los PDF y las capturas con nombres 0.4.0 se mantienen como recursos identificados; el README distingue su edición. La demostración se capturó con el código previo al cambio de metadatos, identificado como 0.4.1, y no prueba el instalador 1.0.0.

## Validación y distribución

La etiqueta `v1.0.0` debe apuntar al mismo commit preparado en `main`, con `package.json` y la raíz de `package-lock.json` en `1.0.0`. El workflow CI se activa al actualizar `main`; CD se activa con la etiqueta, valida el código y publica únicamente después de superar sus controles de instalador, actualización, firma y timestamp.

Esta nota no declara aprobados resultados futuros. El instalador y sus hashes estarán disponibles en la [publicación de GitHub](https://github.com/dmataguerra/comal-queue-system/releases/tag/v1.0.0) cuando CD termine correctamente. Los informes previos conservan su alcance y no certifican el nuevo artefacto.

Se mantienen los límites operativos documentados: servidor solo en loopback, YouTube opcional en escritorio, servicios externos dependientes de internet y aceptación física de TV/HDMI/bocinas independiente de las pruebas automáticas. El preflight de jornada no equivale a ejecutar los 390 minutos reales. Utiliza la [lista de publicación](lista-publicacion.md) para comprobar cada instalador en destino.

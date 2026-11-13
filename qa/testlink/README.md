# TestLink para QA de Comal

Entorno local de evaluación: http://127.0.0.1:8090. Comal sigue ejecutándose como aplicación Electron/Node local; no necesita XAMPP ni se incorpora a esta base de datos.

## Inicio reproducible

Desde PowerShell ejecutar `./qa/testlink/setup.ps1`. El script genera `.env` únicamente si no existe, inicia los servicios y configura el esquema oficial TestLink 1.9.20. No importa datos de ejemplo ni elimina proyectos. La inicialización detecta esquemas parciales o versiones inesperadas y se detiene antes de sobrescribirlos.

Acceso: usuario `admin`; contraseña privada en `qa/testlink/.env`, campo `TESTLINK_ADMIN_PASSWORD`. El adaptador de automatización usa `TESTLINK_API_URL` y `TESTLINK_API_KEY` del mismo archivo. `.env` está ignorado por Git. Las variables de los contenedores son accesibles al administrador de Docker: estos secretos son para el entorno local, no un gestor de secretos de producción.

Comprobación de infraestructura: `./qa/testlink/verify.ps1`. Valida login con CSRF, página autenticada, consulta XML-RPC y HTTP403 en `/install` y `/docs`. Estas comprobaciones son de integración, no una regresión completa de Comal.

Para detener sin perder datos: desde esta carpeta `docker compose down`. Para reanudar: `./setup.ps1`. No usar `down -v`, porque elimina los datos persistentes.

## Versiones y procedencia

La rama oficial actual consultada es `testlink_1_9_20_fixed`, revisión `444bceb5fc24d61bea0816d3011073a4c9c43a32`. La imagen recomendada por `README.containers.md` está fijada por digest en `compose.yaml` (no depende de futuras modificaciones de su etiqueta). MySQL 8.3.0 también está fijado por digest. La imagen incluye PHP 7.4.33; este entorno conserva la base del Dockerfile oficial y la plataforma PHP7.4.2 de Composer. No se afirma que PHP7.4 sea una versión con soporte vigente ni que esta imagen sea apropiada para exposición pública.

Se contrastaron los hashes SHA256 normalizados a LF de tres archivos entre la imagen y la revisión oficial:

| Archivo | SHA256 |
|---|---|
| README.md | 36744ebaf41824f8abc73998d0e99eea5d0c06fd766b93cb1fc81da1a2f886ed |
| lib/api/xmlrpc/v1/xmlrpc.php | 9c7a2320cf0bc489f3cd17db2c0fabce6c0d0e5555717cd0e29cc96d8a6a3669 |
| composer.lock | 21c5c85ef38a301d7a87bca5925b9c100cf64ed4c29515b51c0102f0e546270c |

Estos contrastes identifican archivos concretos; no constituyen una comparación exhaustiva de todo el árbol de la imagen.

## Corrección mínima de compatibilidad

La fuente oficial y la imagen contienen el error `(arrya)$this->tplanMgr->getPlatforms(...)` en `lib/api/xmlrpc/v1/xmlrpc.class.php`, línea3557. Causa un error de sintaxis PHP y HTTP500 en cualquier llamada XML-RPC. `bootstrap.php` aplica de forma reproducible e idempotente la sustitución `(arrya)` → `(array)`. Se verificó con `php -l` y llamadas reales a XML-RPC. Por ello esta instalación es la revisión oficial con un parche local explícito.

Los directorios `/install` y `/docs` se bloquean por Apache después de inicializar. La configuración de avisos permanece en modo `FILE`, como el valor oficial: revisar `/var/testlink/logs/config_check.txt`. Puede advertir que el directorio de instalación existe (su acceso HTTP está bloqueado) y que SMTP no está configurado. El envío de correo no es parte de la integración de fase4; permanece desactivado.

## Persistencia y actualizaciones

`database` guarda el esquema y todos los resultados; `uploads` los adjuntos; `application` el código, configuración y parche de TestLink; `logs` los registros. Respaldar base de datos y adjuntos juntos, además de la configuración y `.env`. El volumen `application` conserva el código previo aunque se cambie la imagen. Una actualización requiere respaldo, nueva revisión y migración explícita; cambiar una etiqueta no actualiza ese volumen.

No hay puertos de base de datos publicados. La interfaz web se vincula exclusivamente a 127.0.0.1. Este despliegue es un entorno de QA local.

Referencias: https://github.com/TestLinkOpenSourceTRMS/testlink-code/blob/testlink_1_9_20_fixed/README.containers.md y https://github.com/TestLinkOpenSourceTRMS/testlink-code/tree/444bceb5fc24d61bea0816d3011073a4c9c43a32.

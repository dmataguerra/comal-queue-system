# Lista de publicación Windows

Complete una copia por cada instalador. No declare aprobada una prueba sin su salida o evidencia.

| Dato o prueba | Evidencia / resultado |
| --- | --- |
| Commit o etiqueta exacta (`git rev-parse HEAD`) y estado de cambios | ____ |
| Versión de `package.json` y nombre de instalador | ____ |
| Node (`node --version`) y npm (`npm --version`) | ____ |
| Respaldo fechado de `config.json`, `estado.json`, `contenido/` y logs con app cerrada | ____ |
| `npm ci` | ____ |
| `npm run format:check` | ____ |
| `npm run lint` | ____ |
| `npm test` | ____ |
| `npm run build` | ____ |
| `npm run test:recovery`, hashes y rechazo de respaldo corrupto | ____ |
| `npm audit --json` y SBOM (`npm sbom --sbom-format cyclonedx`) | ____ |
| `npm run test:desktop` en datos aislados | ____ |
| `npm run test:full-day` jornada de 390 minutos reales (6 h 30 min), métricas, vencimientos y audio | **PASS local, 2026-10-02**: 124/124 anuncios. [Evidencia y alcance](resultado-jornada-2026-10-02.md). Vincular/revalidar con el candidato final en destino. |
| `npm run test:installed` sobre el SHA-256 exacto; revisar `resultado.json` | ____ |
| Prueba de escritorio offline y estado/config corruptos en datos aislados | ____ |
| Voz 00–99 y aviso: validación automática y escucha humana | ____ |
| TV desconectada/reconectada, ventana pública terminada y reinicio/persistencia | ____ |
| `npm run test:browser`, `test:hardening`, `test:media`, `test:interface`, `test:theme` | ____ |
| Ayuda header/F1, zoom 70–130%, am/pm, avisos desplegables y tema estable | ____ |
| Manuales y PDF actualizados al commit; revisión visual | ____ |
| `npm run desktop:build:signed` y ruta del candidato firmado | ____ |
| SHA-256 (`Get-FileHash` sobre el instalador exacto) | ____ |
| Firma válida (`Get-AuthenticodeSignature`); unsigned solo para pruebas, no para publicación | ____ |
| `scripts/verificar-firmas.ps1`: Setup, aplicación y desinstalador válidos, huella aprobada y timestamp | ____ |
| Entorno production: revisores y restricciones de tags/rama comprobados en GitHub | ____ |
| Derechos de recursos y responsable de aceptación operacional | ____ |
| Instalación nueva con usuario estándar y dos pantallas | ____ |
| Actualización desde versión anterior y conservación de datos | ____ |
| Migración de SQLite 0.2.0 al formato JSON vigente y conservación de la base anterior | ____ |
| Restauración de respaldo en carpeta aislada | ____ |
| Reversión probada: cerrar app, reinstalar instalador anterior verificado, restaurar respaldo y comprobar llamadas | ____ |
| Problemas conocidos aceptados y responsable | ____ |

El smoke automático no sustituye la prueba en la PC, TV, HDMI, escala de Windows y bocinas reales. Con una pantalla secundaria, compruebe fullscreen y modo extendido; sin ella, compruebe la ventana pública en el display primario. Para revertir, cierre la aplicación, conserve una copia de los datos actuales, instale la versión anterior verificada y restaure su respaldo con `scripts/datos.ts`; compruebe versión, turnos, multimedia y voz antes de atender clientes. Si cambia el formato de datos entre versiones, pruebe la restauración con la versión anterior en un directorio aislado antes de tocar producción.

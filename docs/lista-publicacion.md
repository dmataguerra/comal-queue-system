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
| `npm run test:desktop` en datos aislados | ____ |
| Prueba de escritorio offline y estado/config corruptos en datos aislados | ____ |
| Voz 00–99 y aviso: validación automática y escucha humana | ____ |
| TV desconectada/reconectada, ventana pública terminada y reinicio/persistencia | ____ |
| `npm run desktop:build` y ruta del instalador | ____ |
| SHA-256 (`Get-FileHash` sobre el instalador exacto) | ____ |
| Firma (`Get-AuthenticodeSignature`) o «no firmado» | ____ |
| Instalación nueva con usuario estándar y dos pantallas | ____ |
| Actualización desde versión anterior y conservación de datos | ____ |
| Restauración de respaldo en carpeta aislada | ____ |
| Reversión probada: cerrar app, reinstalar instalador anterior verificado, restaurar respaldo y comprobar llamadas | ____ |
| Problemas conocidos aceptados y responsable | ____ |

El smoke automático no sustituye la prueba en la PC, TV, HDMI, escala de Windows y bocinas reales. Para revertir, cierre la aplicación, conserve una copia de los datos actuales, instale la versión anterior verificada y restaure su respaldo con `scripts/datos.ts`; compruebe versión, turnos, multimedia y voz antes de atender clientes. Si cambia el formato de datos entre versiones, pruebe la restauración con la versión anterior en un directorio aislado antes de tocar producción.

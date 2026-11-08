# Reporte de validación QA

Para la explicación del alcance, la relación entre Selenium y TestLink y el
entregable esperado, consultar [alcance-y-entregable-final.md](./alcance-y-entregable-final.md).

## Alcance

Validación de la infraestructura de QA y de la integración mínima obligatoria sobre
Comal `1.0.0` (revisión `028a964`). La regresión completa del producto, las
pruebas físicas de audio/TV y las pruebas de instalación no forman parte de esta
ejecución.

## Evidencia reproducible

| Componente               | Resultado                                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `npm run build`          | PASS                                                                                                           |
| `qa/testlink/verify.ps1` | PASS: login, índice autenticado, XML-RPC y bloqueo de `/install` y `/docs`                                     |
| `npm run qa:integration` | PASS                                                                                                           |
| Caso de producto         | `COMAL-QA-001` → TestLink `COMAL-50`, build `7`, ejecución `9`                                                 |
| Flujo Selenium           | PASS: captura real de `42` y lectura de `42` en la vista pública                                               |
| Evidencia                | Adjunta en TestLink: `publica-42.png`, 650302 bytes                                                            |
| Control negativo         | PASS: `INFRA-ADAPTER-001` conservó estado `f` en ejecución `10`                                                |
| Catálogo                 | 43 casos registrados en el proyecto `Comal QA integración`, plan `Integración fase 4`                          |
| Persistencia             | PASS: contenedores recreados sin volúmenes; esquema, catálogo, ejecuciones y adjunto permanecieron disponibles |

El reporte detallado de la ejecución se genera en
`test-results/qa-integration/report.json` y el mapa documental en
`test-results/qa-integration/catalog-map.json`. Esos archivos son artefactos
locales ignorados por Git para no incluir capturas ni datos de entorno.

## Cobertura alcanzada

El catálogo contiene 43 escenarios trazables a los casos de uso y rutas de
implementación. Incluye smoke, funcionales, negativos, límites, integración,
API/unitarias, permisos por transporte y escenarios no funcionales cuando la
implementación permite verificarlos. La suite Selenium UI ejecutó y reportó
`COMAL-QA-001`, `COMAL-QA-003` y `COMAL-QA-011`, con capturas locales. El
control del adaptador también tiene ejecución documentada y una evidencia
adjunta en TestLink. Las ejecuciones UI quedan registradas en TestLink; en la
última corrida TestLink conservó los resultados, pero devolvió un error de
inserción para los tres adjuntos, por lo que se conservan como evidencia local
y no se declaran falsamente como adjuntos remotos. Los demás casos permanecen
`planned` y no se reportan como aprobados.

## Limitaciones y trabajo pendiente

- Ejecutar la regresión de los 43 escenarios y publicar sus resultados.
- Añadir automatización para los escenarios Selenium restantes cuando existan
  criterios de datos y aislamiento definidos.
- Validar audio, monitores, legibilidad a distancia y el instalador en el equipo
  físico objetivo.
- Revisar periódicamente la imagen fijada de TestLink y migrar fuera de PHP 7.4
  cuando exista una ruta compatible y validada.

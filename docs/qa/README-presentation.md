# Presentaciones QA

Hay dos presentaciones. La vigente es la segunda.

| Archivo                                     | Estado                                                                                                                                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Comal Queue System Quality Assurance.pptx` | **Registro de la fase 4.** Describe la integración inicial: 43 escenarios diseñados y la regresión todavía pendiente. No refleja el resultado final.                                               |
| `QA y Pruebas - Comal Queue System.pptx`    | **Vigente.** En español, con la regresión final del 8 de noviembre de 2026: 46 casos, TestLink build 26, 37 PASS, 0 FAIL y 9 BLOCKED. Se editó directamente; no tiene generador en el repositorio. |

Las cifras de la presentación vigente proceden de
[regression-summary.json](regression-summary.json) y del
[reporte final](../../qa/management/reporte-final.md). Las capturas de
`evidence/` son las de los casos COMAL-QA-001, 003 y 011.

## Regenerar la presentación de la fase 4

`generate_presentation.py` solo produce el archivo de la fase 4 y conserva sus
textos originales de 43 escenarios. Requiere Python con `python-pptx`:

```powershell
py -3 docs\qa\generate_presentation.py
```

El script usa texto de los artefactos QA versionados y capturas locales del
manual en `docs\user-manual\source\screenshots\0.4.0\`. No ejecuta pruebas ni
modifica código productivo. Para presentar el estado actual, usar o editar la
presentación vigente.

# Plan y control de integración QA

Alcance autorizado: fases 1 a 4. Las fases 5 (ejecución del catálogo) y 6 (regresión final) quedan pendientes. Una prueba mínima real de comunicación forma parte del criterio obligatorio de la fase 4.

Revisión inicial Comal: 028a964015c12fdfc9e4a70a08c7d3157dfea190, versión package.json 1.0.0. Fecha: 2026-11-04.

## Responsabilidades

PM: integra, revisa evidencia y decide avance. DevOps: qa/testlink. Selenium: qa/automation y dependencias npm. Analista: qa/catalogo. Toda coordinación entre agentes pasa por PM.

## Fases y criterios

1. Discovery: identificar arquitectura real, versión, documentación y servicios activos. Comal es Electron/React con HTTP/SSE loopback, JSON local y sin base de datos de negocio. TestLink es servicio separado con MySQL; Docker 29.8.2 operativo. El documento original conserva notas históricas, por lo que se contrasta con código.
2. Planning: asignar archivos, definir trazabilidad y aislar datos de prueba. TestLink en 127.0.0.1:8090; Comal de prueba con carpeta de datos y puerto aislados. Selenium local para respetar loopback. Mantener secretos fuera de Git. No crear roles de Comal inexistentes.
3. Parallel execution: infraestructura instalada y API disponible; framework con dependencias reales; catálogo contrastado con código. Cada agente documenta comprobaciones y limitaciones.
4. Incremental integration: comprobar por orden TestLink/DB, API, inicio Comal aislado, Selenium real, publicación de resultado y lectura de confirmación. Verificar persistencia tras recrear contenedores sin eliminar volúmenes. Guardar evidencia sin secretos. No afirmar cobertura completa por un smoke.

## Estado

- Fase 1: auditoría inicial validada (README, package.json, arquitectura vigente, casos originales, Docker ps).
- Fase 2: plan y separación de responsabilidades definidos; prueba integradora COMAL-QA-001 acordada.
- Fases 3 y 4: completadas (TestLink en Docker, Selenium, catálogo de 43 casos, integración verificada).
- Fase 5 (2026-11-07/08): catálogo completo ejecutado con `npm run qa:regression`; 2 fallos de automatización (espera inestable en integration.mjs) corregidos; error TestLink 6002 diagnosticado y resuelto.
- Fase 6 (2026-11-08): regresión final 37 PASS / 0 FAIL / 9 BLOCKED sobre 46 casos (044–046 añadidos para cerrar huecos de cobertura), TestLink build 26, lectura confirmada. Ver reporte-final.md.

## Decisiones

- No reemplazar el servidor de Comal por XAMPP ni añadir base de datos al producto.
- Verificar la versión de código dentro de la imagen TestLink, además de su etiqueta.
- No confundir documentación de casos diseñados con resultados ejecutados.
- El smoke de integración verifica UI y registro en TestLink; no certifica audio físico, TV, instalación ni toda la regresión.

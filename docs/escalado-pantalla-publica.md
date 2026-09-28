# Pantalla pública: composición Full HD

La pantalla pública conserva el diseño original de 1920 × 1080 (16:9).
`DisplayCanvas` calcula la escala como el menor de ancho disponible / 1920
y alto disponible / 1080. El lienzo completo se centra y escala: turnos,
multimedia, anuncios, footer, logos y texto mantienen sus proporciones.

El cálculo usa el espacio efectivo de la ventana en píxeles CSS, por lo que
también responde al zoom, al cambio de monitor y al escalado de Windows.
Una ventana efectiva de 3840 × 2160 usa escala 2; una de 1280 × 720 usa 2/3.
Otras proporciones muestran márgenes negros, sin recortar el contenido.
La vista pública mantiene esta composición incluso en ventanas pequeñas.

Las medidas de `public.css` están expresadas en coordenadas del diseño base.
No introducir unidades de viewport ni breakpoints de ventana dentro del lienzo:
harían que la composición cambiara antes de aplicar su escala uniforme.
Se conserva el control de tamaño existente y la interfaz del operador.

Verificación: ejecutar `npm run build` y luego
`npx electron scripts/smoke-display-scale.mjs`. La prueba compara proporciones
de paneles, footer, texto y logos al redimensionar y cambiar el zoom.
Las capturas Full HD y 4K se guardan en `test-results/display-1920.png`
y `test-results/display-3840.png`.

# Turnero El Comal — Requerimientos y casos de uso

## Estado vigente al 1 de octubre de 2026

La tabla siguiente contrasta las notas originales con 0.3.1. Las secciones posteriores conservan la propuesta del 11 de septiembre; si discrepan, esta tabla, [el manual](user-manual/operador.md) y el código vigente definen el comportamiento implementado.

| Área / requisito | Implementación vigente |
| --- | --- |
| RF-01 / entrada | 1–6 dígitos, últimos dos, 00–99; entradas largas/incorrectas se rechazan sin mutar. |
| RF-02/04/05/06 | Actual + cinco anteriores; sin duplicados; nueva llamada desplaza el más antiguo. |
| RF-03 / audio | Aviso + voz local; una repetición por defecto, configurable a dos. Acuse software por ID/número. |
| RF-07 / corrección | Implementada, silenciosa y de un nivel; no persiste tras reinicio. Quitar elimina corrección pendiente. |
| Vencimiento | Cinco minutos desde el último anuncio; no es un estado de negocio EXPIRADO almacenado. |
| Capacidad audio | Seis tareas incluida la activa; aviso desde cinco, rechazo sin mutación al llenarse. |
| RF-08 / interfaz | Reloj de 12 horas am/pm, tema Azul/Morado, tamaño 70–130% y ondas sutiles. |
| RF-10/11/12/14 | Videos/banners locales e importación asíncrona; atenuación durante voz. Videos 2 GB, imágenes 25 MB y reserva 512 MB. |
| RF-13 / pantallas | Dos ventanas Electron; TV extendida fullscreen o ventana pública en monitor primario. HTTP solo misma PC. |
| RF-15 / configuración | Voz 0–300%, música 0–100%, repeticiones 1/2; valores completos en config.json. |
| RF-16 / ayuda | Encabezado/F1, Escape cierra; Diagnósticos al final. Sin ayuda duplicada en sidebar. |
| Persistencia | JSON atómico antes de anunciar, copia/restauración CLI y migración legacy SQLite de solo lectura. |
| Multimedia externa | YouTube opcional en escritorio, deshabilitado en navegador; respaldo local. |
| Fuera de alcance | Mostradores, ventas, estados de entrega/cancelación, historial y cuentas de administrador. |

## Notas originales de reunión y propuesta

> v0.2 · 11 sep 2026 · referencia histórica

---

## 1. Contexto

El Comal cobra con un sistema de tickets **que no se puede integrar**. 
Además, la cocina entrega en desorden — una torta sale antes que unos chilaquiles pedidos primero.

Esas dos cosas juntas eliminan la posibilidad de una cola predecible. No hay «siguiente turno» que
calcular, porque el orden de salida lo decide la cocina, no el sistema. Entonces el sistema hace
una sola cosa:

> **Alguien teclea el número de un ticket. La pantalla lo muestra grande y una voz lo anuncia.**

En palabras del profesor: *un turnero electrónico de 7 segmentos, pero bonito*.

### Qué es y qué no es

| Es                                 | No es |
| Un anunciador de pedidos listos    | Una cola de espera |
| Captura manual, un número a la vez | Un sistema que recibe pedidos |
| Pantalla + voz, sin internet       | Una lista de turnos por atender |
| Una PC, una TV                     | Múltiples cajas o ventanillas tipo banco |

El sistema **no sabe** qué pedidos existen, cuántos faltan, ni en qué orden deberían salir. Solo
sabe qué número acaba de teclear el operador y cuáles fueron los cinco anteriores.

---

## 2. Actores

| Actor             | Descripción                                 | Qué hace en el sistema |
| **Operador**      | El cocinero, o quien entrega los platillos. | Solo teclea números y presiona Enter.     |
| **Cliente**       | Quien espera su pedido.                     | Nada. Ve 
la pantalla y escucha el anuncio. |
| **Administrador** | El equipo de desarrollo                     | Carga videos e imágenes, ajusta la configuración. |
| **Sistema**       | La aplicación misma.                        | Arranca solo, reproduce contenido, anuncia turnos. |

El **Cliente no interactúa**: es un actor pasivo, receptor de la información. Se incluye porque
define los requerimientos de legibilidad y audio (RNF-08, RF-03), no porque ejecute casos de uso.

---

## 3. Modelo de estado de un número

No hay máquina de estados de negocio: un número solo puede estar en tres lugares de la pantalla.

```
                         ┌──────────── rellamado (CU-02) ─────────────┐
                         │                                            │
                         ↓                                            │
  (sin mostrar) ──teclea──→ TURNO ACTUAL ──entra otro turno──→ EN LLAMADOS (1…5)
                         ↑                                            │
                         │                              entra el 6.º  │
                         │                                            ↓
                         └──── rellamado (entra como nuevo) ──── FUERA DE PANTALLA
```

**No existen** los estados `AUSENTE`, `CANCELADO` ni `EXPIRADO`. Si un cliente no se acerca, su
número simplemente se desplaza en la lista hasta salir de pantalla (RN-03). Si vuelve, se rellama
y punto.

---

## 4. Requerimientos funcionales

### 4.1 Llamado de turnos

| ID | Requerimiento |
|---|---|
| **RF-01** | El operador captura el número de turno en un campo numérico y presiona Enter. |
| **RF-02** | El turno llamado se muestra como **turno actual**, destacado con recuadro y color. |
| **RF-03** | Al llamar un turno suena un aviso (*tin-tin*) y una voz dice «Turno N». El anuncio se repite según configuración: 1 o 2 veces, **con 2 por defecto** por indicación del profesor. |
| **RF-04** | Al llamar un turno nuevo, el turno actual baja a la lista de llamados. |
| **RF-05** | La lista de llamados tiene **máximo 5** turnos, con el más reciente arriba. Cuando entra el sexto, sale el más viejo. |
| **RF-06** | **Rellamar:** si el número ya está en la lista, se quita de ahí y vuelve a ser el turno actual, sin duplicarse. Si ya salió de la lista, también se puede rellamar. |
| **RF-07** | **Corregir un número mal capturado.** ⚠️ Propuesto por el equipo, no surgió en la reunión — pero va a pasar el primer día. **Validar con el profesor.** |

### 4.2 Pantalla pública

| ID | Requerimiento |
|---|---|
| **RF-08** | Franja azul superior a todo lo ancho con los logos, la fecha y la hora en tiempo real. ⚠️ El logo es el de la facultad y probablemente el de la UAQ; en la transcripción dice «el TR o ese» — **confirmar**. |
| **RF-09** | El turno actual y la lista de llamados se ubican arriba. El resto del espacio es para contenido. |
| **RF-10** | Se reproducen videos musicales **locales**. Al terminar uno, se elige otro al azar. |
| **RF-11** | Al llamar un turno, la música baja de volumen, suena el anuncio, y luego la música regresa a su nivel. |
| **RF-12** | **Modo alterno sin música:** un banner con imágenes de eventos de la facultad y logos animados. |

### 4.3 Operación

| ID | Requerimiento |
|---|---|
| **RF-13** | La interfaz del operador está **separada** de la pantalla pública. En la TV nunca se ve el campo de captura. |
| **RF-14** | Se pueden agregar o quitar videos e imágenes **sin tocar código**. Con una carpeta basta. |
| **RF-15** | Se pueden configurar las repeticiones del anuncio y los volúmenes de música y voz. |
| **RF-16** | La interfaz incluye ayuda, y se entrega un manual de usuario breve. |

---

## 5. Reglas de negocio

| ID | Regla |
|---|---|
| **RN-01** | Solo hay **un** turno actual a la vez. |
| **RN-02** | Los turnos **no son consecutivos**. El sistema no valida orden ni detecta números saltados. |
| **RN-03** | **No existe** el estado «no se presentó». Si alguien no pasa, su turno se queda en llamados y eventualmente sale de la lista. |
| **RN-04** | Ningún número aparece **dos veces** en pantalla. |
| **RN-05** | Si se captura el número que ya es el actual, **solo se repite el anuncio**. |

---

## 6. Requerimientos no funcionales

| ID | Requerimiento |
|---|---|
| **RNF-01** | Funciona **100% sin internet**, incluida la voz. El profesor fue explícito en esto. |
| **RNF-02** | Corre en **Windows 11**, posiblemente en la PC actual de la cafetería, con una sola pantalla pública por HDMI. |
| **RNF-03** | Del Enter a que el número aparezca en pantalla con sonido pasa **menos de 1 segundo**. |
| **RNF-04** | Se opera **solo con teclado** (número + Enter), sin más capacitación que el manual. |
| **RNF-05** | Respeta la identidad institucional: paleta de azules de marino a cian, con naranja y amarillo **solo como acento**; tipografía **Futura**; logos oficiales. ⚠️ El profesor enviará paleta, tipografía, logos y video de referencia. |
| **RNF-06** | Aguanta **toda la jornada** sin degradarse. Horas de video en bucle son la prueba real de estabilidad. |
| **RNF-07** | **Arranca solo y en pantalla completa** al encender la PC. Si se va la luz, se recupera sin intervención. |
| **RNF-08** | El número se lee bien **desde la distancia real** a la que están los clientes. |
| **RNF-09** | **No usa base de datos**, como indicó el profesor. Aun así, se recomienda que el estado sobreviva a una recarga accidental. |

### Nota sobre RNF-09

«Sin base de datos» y «que sobreviva a una recarga» no se contradicen. La solución es un archivo
local ligero (un JSON de una línea) o `localStorage`: persiste el turno actual y los cinco
llamados, sin motor de base de datos, sin esquema y sin instalación. Cumple las dos cosas.

---

## 7. Fuera de alcance

- **La integración con el sistema de cobro.** Confirmado imposible con el desarrollador original.
- **La lista de «turnos por atender».** Descartada por el profesor: implicaría capturar cada
  pedido dos veces, una en la caja y otra en el turnero.
- **Múltiples pantallas, cajas o ventanillas** tipo banco.
- **Las pantallas de menú**, que el profesor maneja aparte. Solo conviene que se vean homogéneas
  con el turnero.
- **Historial y estadísticas.**

---

## 8. Casos de uso

### CU-01 — Llamar turno

- **Actor principal:** Operador
- **Precondiciones:** el sistema está corriendo; la pantalla pública es visible en la TV
- **Disparador:** la cocina entrega un platillo

**Flujo principal**

1. El operador teclea el número del ticket en el campo numérico.
2. Presiona Enter.
3. El sistema valida el número.
4. El turno actual pasa al primer lugar de la lista de llamados (RF-04).
5. La lista se recorta a 5 elementos; el más antiguo sale de pantalla (RF-05).
6. El número nuevo se muestra como turno actual, destacado con recuadro y color (RF-02).
7. La música baja de volumen (RF-11).
8. Suena el aviso y la voz anuncia «Turno N», las veces configuradas (RF-03, RF-15).
9. La música vuelve a su volumen normal.
10. El campo de captura se limpia y queda listo para el siguiente número.

**Flujos alternos**

- **3a.** El número es inválido o el campo está vacío → **nada cambia en la TV**; el aviso se
  muestra únicamente en la vista del operador.
- **3b.** El número ya está en la lista de llamados → continúa en **CU-02**.
- **3c.** El número ya es el turno actual → **solo se repite el anuncio** (RN-05); ni el turno
  actual ni la lista cambian.
- **4a.** Es el primer llamado de la jornada y no hay turno actual → la lista sigue vacía y solo
  se llena el turno actual.

**Postcondiciones:** N es el turno actual; la lista tiene a lo más 5 números; ningún número
aparece repetido en pantalla (RN-04).

**Cubre:** RF-01, RF-02, RF-03, RF-04, RF-05, RF-11, RF-15 · **Reglas:** RN-01, RN-04, RN-05

---

### CU-02 — Rellamar turno

- **Actor principal:** Operador
- **Precondiciones:** el número N ya fue llamado antes — está en la lista, o ya salió de ella
- **Disparador:** el cliente no se acercó cuando se llamó su número

**Flujo principal**

1. El operador teclea el mismo número y presiona Enter.
2. El sistema detecta que N ya está en la lista de llamados.
3. Quita N de la lista (RF-06).
4. El turno actual baja al primer lugar de la lista.
5. N vuelve a ser el turno actual.
6. Se anuncia el turno, igual que en CU-01 pasos 7 a 9.

**Flujos alternos**

- **2a.** N ya salió de la lista (pasó el sexto llamado) → se trata exactamente como CU-01: entra
  como turno actual nuevo. El resultado en pantalla es el mismo.
- **2b.** N es el turno actual → RN-05: solo se repite el anuncio.

**Postcondiciones:** N es el turno actual y aparece una sola vez en pantalla (RN-04).

**Cubre:** RF-06 · **Reglas:** RN-01, RN-04, RN-05

> **Decisión de diseño.** Para el operador, CU-01 y CU-02 son **la misma acción**: teclear un
> número y presionar Enter. El sistema decide qué hacer. Es deliberado — una sola forma de operar,
> nada que aprender, ningún botón de «rellamar» que se pueda elegir mal (RNF-04).

---

### Tabla de decisión del llamado

Esta tabla es el núcleo del sistema: todo lo que ocurre cuando el operador presiona Enter.

| El número que teclea…    | Turno actual          | Lista de llamados                                       | Anuncio |
| es nuevo                 | pasa a ser N          | el actual anterior entra arriba; se recorta a 5         | sí |
| está en la lista         | pasa a ser N          | **N sale de la lista**; el actual anterior entra arriba | sí |
| ya es el actual          | no cambia             | no cambia                                               | sí, se repite |
| ya salió de la lista     | pasa a ser N          | el actual anterior entra arriba; se recorta a 5         | sí |
| está vacío o es inválido | no cambia             | no cambia                                               | **no** |

---

### CU-03 — Corregir captura ⚠️

- **Actor principal:** Operador
- **Precondiciones:** hay al menos un llamado hecho en la jornada
- **Disparador:** el operador se da cuenta de que tecleó un número equivocado
- **Estado:** ⚠️ **propuesto por el equipo.** No se mencionó en la reunión.

**Flujo principal**

1. El operador activa *Deshacer último* desde su vista.
2. El sistema restaura el estado anterior al último llamado: el turno actual previo vuelve a ser
   el actual, y la lista de llamados vuelve a como estaba.
3. **No se emite anuncio.**

**Flujos alternos**

- **1a.** No hay ningún llamado previo en la jornada → la acción aparece deshabilitada.
- **2a.** Solo se puede deshacer **el último** llamado, no una cadena de llamados.

**Postcondiciones:** la pantalla queda como antes del llamado erróneo.

**Nota de diseño.** El deshacer es silencioso a propósito. Si la TV ya mostró un número
equivocado, lo que se necesita es quitarlo rápido, no volver a hablar. El siguiente llamado
correcto ya trae su propio anuncio.

**Cubre:** RF-07

---

### CU-04 — Reproducir contenido

- **Actor principal:** Sistema
- **Precondiciones:** hay videos o imágenes en la carpeta de contenido

**Flujo principal**

1. Al iniciar, el sistema elige un video al azar de la carpeta local (RF-10).
2. Lo reproduce en el área de contenido, debajo de la franja de turnos (RF-09).
3. Al terminar, elige otro al azar, **sin repetir** el que acaba de terminar.

**Flujos alternos**

- **1a.** No hay videos cargados → entra el **modo banner**: imágenes de eventos de la facultad y
  logos animados (RF-12).
- **2a.** Se llama un turno durante la reproducción → CU-01 **baja el volumen**, no pausa el
  video (RF-11).
- **2b.** Un video falla o está corrupto → se salta, se elige el siguiente y se registra en el log.

**Cubre:** RF-09, RF-10, RF-11, RF-12, RF-14

---

### CU-05 — Iniciar jornada

- **Actor principal:** Sistema
- **Disparador:** se enciende la PC

**Flujo principal**

1. El sistema arranca solo, sin que nadie inicie sesión ni abra nada (RNF-07).
2. La pantalla pública aparece en la TV en pantalla completa; la vista del operador, en la pantalla
   del operador (RF-13).
3. La franja superior muestra logos, fecha y hora en tiempo real (RF-08).
4. El turno actual y la lista de llamados arrancan vacíos.
5. Empieza la reproducción de contenido (CU-04).

**Flujos alternos**

- **1a.** Se va la luz a media jornada → al volver la corriente, el sistema arranca igual y se
  recupera sin intervención (RNF-07). Los turnos previos se pierden, lo cual es aceptable: el
  operador simplemente teclea el siguiente número cuando la cocina entregue.
- **2a.** Solo hay una pantalla física conectada → la vista pública se abre como ventana normal en
  el display primario y el operador puede alternar a la ventana de captura. La separación física de
  operador y público de RF-13 solo se cumple cuando existe una pantalla secundaria.
- **4a.** Recarga accidental de la pantalla pública → el estado se restaura desde la persistencia
  ligera de RNF-09, si se implementa.

**Cubre:** RF-08, RF-13 · **No funcionales:** RNF-02, RNF-07, RNF-09

---

### CU-06 — Administrar contenido y configuración

- **Actor principal:** Administrador
- **Precondiciones:** acceso a la carpeta de contenido en la PC

**Flujo principal**

1. Copia o borra videos e imágenes en la carpeta de contenido (RF-14).
2. Ajusta las repeticiones del anuncio (1 o 2) y los volúmenes de música y de voz (RF-15).
3. El sistema toma los cambios sin recompilar ni editar código.

**Flujos alternos**

- **1a.** Se agrega un archivo con formato no soportado → se ignora y se registra en el log.
- **2a.** Los cambios de configuración se aplican en el **siguiente** llamado, no a media
  reproducción de un anuncio en curso.

**Cubre:** RF-14, RF-15

---

## 9. Trazabilidad

| RF            | Caso de uso |
| RF-01 … RF-05 | CU-01 |
| RF-06         | CU-02 |
| RF-07         | CU-03 ⚠️ |
| RF-08         | CU-05 |
| RF-09         | CU-04, CU-05 |
| RF-10, RF-12  | CU-04 |
| RF-11         | CU-01, CU-04 |
| RF-13         | CU-05 |
| RF-14         | CU-04, CU-06 |
| RF-15         | CU-01, CU-06 |
| RF-16         | Entregable, no caso de uso: ayuda en la interfaz + manual breve |

---

## 10. Pendientes antes de la arquitectura

### Pendiente 1 — ¿Dónde está físicamente quien llama el turno?

**Es la pregunta que más define la arquitectura.** Si la PC solo está conectada a la TV, el
operador no tiene dónde ver lo que teclea sin que se vea en la TV, y RF-13 se rompe.

| Escenario | Qué se necesita | Impacto |
| El operador está **junto a la PC** | Un monitor propio + la TV como pantalla extendida | Aplicación de escritorio simple, sin red |
| El operador está **en la barra**, lejos de la PC | Teclado numérico inalámbrico, **o** captura desde un celular por red local | La segunda opción obliga a un servidor local y cambia el diseño completo |

### Pendiente 2 — Formato del ticket

Averiguar **cuántos dígitos tiene** y **si se reinicia** cada día o al llegar a 99. De ahí salen
la validación y la estrategia de voz.

La idea de audios pregrabados del 01 al 99 es buena y cumple RNF-01 (funciona sin internet). Si
el ticket usa tres dígitos, se pueden generar los audios una sola vez y armar el anuncio por
concatenación.

### Pendiente 3 — ¿Qué ocupa el área grande de la pantalla?

En la reunión se mencionaron **tanto** los videos musicales **como** la publicidad de la facultad.

---

## 11. Preguntas para la visita a El Comal

- [ ] El formato del ticket: dígitos y reinicio *(Pendiente 2)*
  El formato es de 6 dígitos pero para el uso del entendimiento general, solo se toman en cuenta los últimos dos
  Ejemplo; 213298, en este caso el turno es el 98, al tomar dos turnos más, se repite el flujo en este caso 00
- [ ] Quién llama los turnos y **desde dónde** *(Pendiente 1)*
  Los llama el que atiende la barra, normalmente es un conector entre cocina y caja, siempre se mantiene en medio y cerca de ambos
- [ ] El horario de servicio
  8:30am a 3:00pm, a espera de eventos que cambien esto puede abrir después o cerrar antes
- [ ] Tamaño y ubicación de la TV, y si tiene bocinas *(RNF-08)*
  
- [ ] Cuántos turnos salen en hora pico — **esto valida el límite de 5** de RF-05

- [ ] Qué música prefieren *(Pendiente 4)*

Al cerrar los pendientes 1 y 2, se puede pasar a la arquitectura.

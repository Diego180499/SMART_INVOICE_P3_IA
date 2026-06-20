# Manual de Usuario — SmartInvoice

> Versión del documento: 1.0 · Aplicación web administrativa para el procesamiento inteligente de facturas.

Este manual explica, de forma práctica y para usuarios sin conocimientos técnicos, **qué hace SmartInvoice, qué es capaz de lograr y cómo usar cada una de sus funciones** desde el navegador web. Incluye una **sección especial dedicada al RPA (Automatización Robótica de Procesos)** donde se detalla su función dentro de la aplicación y su uso paso a paso.

---

## 1. ¿Qué es SmartInvoice?

SmartInvoice es una aplicación web que **automatiza el procesamiento de facturas**. En lugar de revisar cada documento a mano, copiar los datos y registrarlos uno por uno, el sistema:

1. Recibe la factura como archivo (PDF o imagen).
2. **Lee automáticamente su contenido** mediante Computer Vision y OCR (reconocimiento óptico de caracteres).
3. **Extrae los datos clave** (número de factura, fecha, proveedor, NIT, subtotal, impuestos y total).
4. **Valida** que la información sea coherente.
5. Permite **corregir** lo que el lector automático no haya interpretado bien.
6. Genera **reportes administrativos** (PDF, Excel o CSV).
7. **Automatiza tareas repetitivas** mediante RPA: registrar los datos en un formulario web y enviar reportes por correo electrónico.
8. Mantiene una **bitácora** con el historial completo de todo lo que ocurre en el sistema.

En resumen, convierte un trabajo manual, lento y propenso a errores, en un flujo guiado, rápido y auditable.

### ¿De qué es capaz la aplicación? (resumen)

| Capacidad | Descripción |
|---|---|
| Autenticación segura | Inicio de sesión con usuario y contraseña; roles de administrador y usuario. |
| Gestión de proveedores | Crear, consultar, editar, buscar y desactivar proveedores. |
| Carga de facturas | Subir archivos PDF, JPG, JPEG o PNG (hasta 20 MB), incluso varios a la vez. |
| Lectura automática (OCR) | Extraer los datos de la factura sin escribirlos a mano. |
| Validación automática | Comprobar que `total ≈ subtotal + impuestos` y otros controles. |
| Corrección manual | Ajustar cualquier dato que el OCR no haya leído bien. |
| Reportes | Generar reportes en PDF, Excel o CSV con filtros por fecha y proveedor. |
| RPA | Registrar datos en formularios web y enviar reportes por correo, de forma automática. |
| Bitácora | Consultar el historial de cada operación, con su estado y resultado. |
| Panel de control | Dashboard con métricas y gráficas del estado del procesamiento. |

---

## 2. Conceptos básicos

Antes de empezar, conviene conocer estos términos que se usan en toda la aplicación:

- **Factura:** el documento (archivo) que se sube al sistema para ser procesado.
- **Proveedor:** la empresa o persona que emite la factura. Se administra en su propio catálogo.
- **OCR:** tecnología que "lee" el texto contenido en una imagen o PDF y lo convierte en datos.
- **Datos extraídos:** los campos que el OCR obtuvo de la factura (número, fecha, NIT, montos, etc.).
- **Validación:** verificación automática de que los datos extraídos son coherentes.
- **Estado de la factura:** indica en qué punto del proceso se encuentra (ver tabla más abajo).
- **Reporte:** archivo consolidado (PDF/Excel/CSV) con la información de varias facturas.
- **RPA:** automatización que ejecuta acciones repetitivas por ti (rellenar formularios, enviar correos).
- **Bitácora:** registro cronológico de todas las acciones realizadas en el sistema.
- **Rol:** nivel de permisos del usuario (administrador o usuario estándar).

### Estados de una factura

| Estado | Significado |
|---|---|
| **Pendiente** | La factura se cargó pero aún no se ha procesado con OCR. |
| **Procesado** | El OCR se ejecutó correctamente y los datos están disponibles. |
| **Error** | Ocurrió un problema técnico durante el procesamiento. |
| **Rechazado** | El OCR se ejecutó, pero la validación detectó datos inconsistentes. |

---

## 3. Acceso al sistema

### 3.1 Requisitos

- Un navegador web moderno (Chrome, Edge, Firefox o equivalente).
- La dirección (URL) donde está publicada la aplicación. En una instalación local típica es **http://localhost:8080**.
- Un usuario y contraseña válidos.

### 3.2 Iniciar sesión

1. Abre la aplicación en el navegador.
2. En la pantalla de bienvenida, escribe tu **correo electrónico** y tu **contraseña**.
3. Pulsa **Entrar**.

Si las credenciales son correctas, accederás al panel principal (Dashboard). Si no, el sistema mostrará un aviso indicando que el correo o la contraseña son incorrectos.

> **Usuario de ejemplo (instalación con datos de prueba):** correo `admin@smartinvoice.com`, contraseña `Admin1234!`.

### 3.3 Crear una cuenta

Si no tienes cuenta, en la pantalla de inicio de sesión pulsa **"Crear una cuenta"**, completa tu nombre, correo y contraseña (mínimo 6 caracteres) y pulsa **Crear cuenta e iniciar sesión**. El sistema te registrará como **usuario estándar** y te llevará directamente al panel.

### 3.4 Configuración del servidor (avanzado)

Si la aplicación no logra conectarse con el servidor, en la pantalla de inicio de sesión encontrarás la opción **"Configuración del servidor (API)"**. Ahí puedes indicar manualmente la URL del backend (por ejemplo, `http://localhost:8000`) y guardarla. Normalmente no es necesario tocar esta opción.

### 3.5 Roles y permisos

La aplicación distingue dos tipos de usuario:

- **Usuario estándar:** puede iniciar sesión, gestionar su perfil, cargar facturas, procesarlas con OCR, corregir datos, consultar proveedores, generar reportes, ejecutar RPA y revisar la bitácora.
- **Administrador:** además de todo lo anterior, puede **crear, editar y desactivar proveedores**, **eliminar facturas y reportes**, y **procesar facturas en lote**.

Cuando una acción requiere rol de administrador y tu usuario no lo tiene, el botón correspondiente no aparece o el sistema te informará que no tienes permisos.

### 3.6 Cerrar sesión

En la parte inferior del menú lateral aparece tu nombre y un botón **"Cerrar sesión"**. Por seguridad, la sesión también se cierra automáticamente cuando el acceso expira; en ese caso solo debes volver a iniciar sesión.

---

## 4. La interfaz: cómo está organizada

Una vez dentro, la pantalla se divide en tres zonas:

- **Menú lateral (izquierda):** acceso a todas las secciones — Dashboard, Facturas, Proveedores, Bitácora, Reportes, RPA y Mi perfil. Abajo se muestra tu usuario y el botón para cerrar sesión.
- **Barra superior:** título de la sección actual y, a la derecha, la dirección del servidor al que estás conectado. En pantallas pequeñas, incluye un botón ☰ para mostrar u ocultar el menú.
- **Área de contenido (centro):** donde se muestra y se trabaja cada sección.

La aplicación es **responsiva**: se adapta a computadoras de escritorio, laptops, tabletas y teléfonos.

---

## 5. Dashboard (panel principal)

Es la primera pantalla tras iniciar sesión. Ofrece una vista rápida del estado general:

- **Tarjetas de métricas:** total de facturas, cuántas están procesadas, cuántas pendientes, cuántas con error o rechazadas, y el número de proveedores activos y reportes generados.
- **Gráfica "Facturas por estado":** un gráfico circular que muestra la proporción de facturas en cada estado.
- **Gráfica "Actividad por tipo de acción":** un gráfico de barras con los tipos de operaciones más frecuentes registrados en la bitácora.
- **Facturas recientes** y **Actividad reciente:** listados rápidos para acceder con un clic a lo último que ha ocurrido.

Desde aquí también puedes ir directamente a **cargar una factura** o **generar un reporte** con los botones de la parte superior.

---

## 6. Proveedores

Sección para administrar el catálogo de empresas que emiten las facturas.

**Qué puedes hacer:**

- **Buscar** un proveedor por nombre o NIT.
- **Filtrar** entre "solo activos" o "todos".
- **Ver** la ficha completa de un proveedor (NIT, dirección, teléfono, correo, estado y fechas).
- **Crear** un nuevo proveedor *(solo administradores)*.
- **Editar** los datos de un proveedor existente *(solo administradores)*.
- **Desactivar** un proveedor *(solo administradores)*. La desactivación es un "borrado suave": el proveedor deja de aparecer como activo, pero no se elimina físicamente y puede reactivarse editándolo.

**Para crear un proveedor (administrador):**

1. Entra en **Proveedores** y pulsa **"+ Nuevo proveedor"**.
2. Completa la **razón social** y el **NIT** (obligatorios); opcionalmente dirección, teléfono y correo.
3. Pulsa **Crear proveedor**.

> Si el NIT ya existe, el sistema avisará para evitar duplicados.

---

## 7. Facturas

El corazón de la aplicación. Aquí se cargan, consultan y procesan las facturas.

### 7.1 Cargar una factura

1. Entra en **Facturas** y pulsa **"+ Cargar factura"**.
2. **Arrastra** los archivos al recuadro o haz clic para **seleccionarlos**. Puedes cargar **varios a la vez**.
   - Formatos admitidos: **PDF, JPG, JPEG y PNG**.
   - Tamaño máximo: **20 MB** por archivo.
3. (Opcional) Marca la casilla **"Ejecutar OCR automáticamente tras la carga"** para que el sistema lea las facturas en cuanto se suban.
4. Pulsa **Cargar**.

Cada factura cargada queda inicialmente en estado **Pendiente**.

### 7.2 Consultar y filtrar facturas

El listado muestra todas las facturas con su número, archivo, tipo, estado, proveedor y fecha de carga. Puedes **filtrar** por estado, proveedor y rango de fechas, y navegar entre páginas. Haz clic en cualquier fila (o en **Ver**) para abrir el detalle.

### 7.3 Procesar una factura con OCR

El OCR es lo que "lee" la factura y extrae sus datos. Hay dos formas de ejecutarlo:

- **Individual:** desde el listado, en una factura Pendiente o con Error, pulsa **"Procesar OCR"**; o bien, dentro del detalle de la factura, pulsa **"Procesar OCR"** / **"Reprocesar OCR"**.
- **En lote (solo administradores):** marca las casillas de varias facturas y pulsa **"Procesar selección (OCR)"**. El sistema las procesará una tras otra y te informará cuántas resultaron correctas y validadas.

Al terminar, la factura pasará a **Procesado** (si todo fue bien) o a **Rechazado** (si la validación encontró inconsistencias).

### 7.4 Detalle de una factura

La ficha de cada factura se organiza en pestañas:

- **Datos extraídos:** los campos leídos por el OCR (número, fecha, proveedor, NIT, subtotal, impuestos, total), junto con el **nivel de confianza** del OCR y el resultado de la **validación de coherencia** (por ejemplo, si el total cuadra con subtotal + impuestos).
- **Archivo y proveedor:** información del archivo cargado y del proveedor asociado.
- **Texto OCR:** el texto completo tal como lo reconoció el motor de OCR (útil para verificar).
- **Historial:** la bitácora específica de esa factura (todo lo que se hizo con ella).

### 7.5 Corregir datos extraídos

Si el OCR interpretó algo de forma incorrecta, puedes ajustarlo:

1. Abre el **detalle** de la factura, pestaña **Datos extraídos**.
2. Pulsa **"Corregir datos"**.
3. Modifica los campos necesarios (número, fecha, NIT, montos, etc.).
4. Indica si los datos quedan **validados** y, si quieres, añade una **observación**.
5. Pulsa **Guardar correcciones**.

### 7.6 Eliminar una factura (solo administradores)

En el detalle, el administrador puede pulsar **Eliminar** para borrar la factura y su archivo del servidor. Esta acción es permanente.

---

## 8. Reportes

Permite consolidar la información de las facturas en un solo documento.

### 8.1 Generar un reporte

1. Entra en **Reportes** y pulsa **"+ Generar reporte"**.
2. Elige el **tipo**: **PDF**, **Excel** o **CSV**.
3. (Opcional) Ponle un **nombre**, define un **rango de fechas**, filtra por **proveedor** e indica si deseas **incluir facturas rechazadas**.
4. Pulsa **Generar**. El reporte aparecerá en el listado con la cantidad de facturas incluidas.

### 8.2 Descargar y enviar

En cada reporte del listado puedes:

- **Descargar** el archivo a tu computadora.
- **Enviar por correo** el reporte a un destinatario (esto utiliza el RPA de correo; ver sección 10).
- **Eliminar** el reporte *(solo administradores)*.

---

## 9. Bitácora

La bitácora es el **registro de auditoría** del sistema. Cada acción relevante queda anotada con su fecha y hora, el tipo de acción, su estado (Exitoso, Fallido o Pendiente), la factura involucrada (si aplica) y un resumen del resultado.

Puedes **filtrar** por tipo de acción, estado y rango de fechas, y abrir el **detalle** de cualquier entrada para ver información técnica adicional. Es la mejor herramienta para responder preguntas como "¿quién procesó esta factura y cuándo?" o "¿por qué falló este envío?".

---

## 10. Mi perfil

En **Mi perfil** puedes consultar los datos de tu cuenta (rol, estado, fechas) y **actualizar** tu nombre, tu correo o tu contraseña. Para cambiar la contraseña, escribe la nueva en el campo correspondiente; si lo dejas en blanco, no se modifica.

---

## 11. ⭐ Sección especial: RPA / Automatización

Esta sección está dedicada por completo al módulo **RPA**, una de las capacidades más importantes de SmartInvoice. Aquí se explica **qué es, qué función cumple dentro de la aplicación, de qué es capaz y cómo usarlo paso a paso**.

### 11.1 ¿Qué es el RPA en SmartInvoice?

**RPA** significa *Robotic Process Automation* (Automatización Robótica de Procesos). Es una tecnología que **imita las acciones que haría una persona** frente a una computadora —abrir una página, escribir en un formulario, pulsar botones, enviar un correo— pero ejecutándolas de forma **automática, rápida y sin errores de tipeo**.

Dentro de SmartInvoice, el RPA se encarga de las **tareas repetitivas que vienen después** de que una factura ya fue leída y validada. El usuario no tiene que copiar datos a otro sistema ni redactar correos manualmente: el robot lo hace por él.

### 11.2 Función del RPA dentro de la aplicación

El RPA es el **último eslabón del flujo de trabajo**. El proceso completo es:

```
Cargar factura → Procesar con OCR → Validar/Corregir datos → Generar reporte → 🤖 RPA
```

El RPA cierra el ciclo automatizando dos acciones concretas que normalmente consumirían tiempo manual:

1. **Registrar los datos de una factura en un formulario web externo.**
2. **Enviar un reporte por correo electrónico a un responsable.**

Su función, por tanto, es **eliminar el trabajo manual final** y garantizar que la información procesada llegue a donde tiene que llegar (otro sistema, o la bandeja de entrada de un responsable) de forma confiable y registrada en la bitácora.

### 11.3 ¿De qué es capaz el RPA? (capacidades)

El módulo RPA de SmartInvoice es capaz de:

| Capacidad | Qué hace | Tecnología que usa |
|---|---|---|
| **Registro en formulario web** | Abre una página web (un formulario configurado), localiza sus campos y los rellena automáticamente con los datos extraídos de la factura (número, fecha, proveedor, NIT, total) y envía el formulario. | Automatización de navegador (Playwright), en segundo plano. |
| **Envío de reportes por correo** | Toma un reporte ya generado, lo adjunta a un correo y lo envía al destinatario indicado. | Envío de correo por SMTP. |
| **Historial de ejecuciones** | Registra cada intento (exitoso o fallido) con su fecha, resultado y la factura o reporte involucrado, para que puedas auditarlo. | Bitácora del sistema. |

> **Importante — procesamiento en segundo plano:** cuando ejecutas el registro en formulario, el robot trabaja "detrás de escena" (modo *headless*, sin abrir una ventana visible). Tú solo ves el resultado final: éxito o fallo, con su mensaje.

### 11.4 Requisitos antes de usar el RPA

Para que el RPA funcione, el sistema debe estar correctamente configurado por el administrador o instalador (en el archivo de configuración del backend):

- **Para el registro en formulario web:** debe existir una **URL de formulario** válida configurada (variable `RPA_FORM_URL`). Si no está configurada, el robot indicará que la URL no está disponible y no completará el registro. Esto es normal en una instalación nueva hasta que se defina el formulario destino.
- **Para el envío de correos:** deben estar configuradas las credenciales del servidor de correo (variables `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`). Sin esto, el envío fallará con un mensaje indicándolo.

Como usuario, no necesitas tocar estas configuraciones, pero conviene saber que **si una acción RPA falla por configuración, no es un error tuyo**: el mensaje te dirá qué falta.

### 11.5 Dónde se usa el RPA

El RPA está disponible en **tres lugares** de la aplicación:

1. **Sección RPA** (en el menú lateral): el centro de control, con ambas acciones y el historial.
2. **Detalle de una factura:** botón **"Registrar en formulario (RPA)"** (disponible cuando la factura ya tiene datos extraídos).
3. **Sección Reportes:** botón **"Enviar correo"** en cada reporte (usa el RPA de correo).

### 11.6 Paso a paso: registrar una factura en el formulario web

**Opción A — desde la sección RPA:**

1. Asegúrate de que la factura ya fue **procesada con OCR** y tiene datos extraídos.
2. En el menú lateral, entra en **RPA / Automatización**.
3. En la tarjeta **"Registrar factura en formulario web"**, escribe el **ID de la factura** (el número que aparece como `#1`, `#2`, etc. en el listado de facturas).
4. Pulsa **"Ejecutar RPA"**.
5. Espera unos segundos mientras el robot trabaja en segundo plano. Verás un mensaje con el resultado:
   - ✅ **Éxito:** "Datos registrados correctamente en el formulario web."
   - ⚠️ **Aviso:** si la `RPA_FORM_URL` no está configurada, te lo indicará y no se completará el registro.
6. El intento queda registrado en el **historial** de la misma pantalla.

**Opción B — desde el detalle de la factura:**

1. Abre la factura (Facturas → clic en la factura).
2. Pulsa el botón **"Registrar en formulario (RPA)"** en la parte superior.
3. Lee el mensaje de resultado.

### 11.7 Paso a paso: enviar un reporte por correo

**Opción A — desde la sección Reportes:**

1. Primero **genera un reporte** (ver sección 8) o ubica uno existente.
2. En el listado de **Reportes**, pulsa **"Enviar correo"** en el reporte deseado.
3. Escribe el **correo del destinatario** (por defecto se sugiere el tuyo).
4. Pulsa **Enviar**.
5. Verás el resultado:
   - ✅ **Éxito:** "Reporte enviado correctamente al destinatario."
   - ⚠️ **Aviso:** si el correo no está configurado (SMTP), te lo indicará.

**Opción B — desde la sección RPA:**

1. Entra en **RPA / Automatización**.
2. En la tarjeta **"Enviar reporte por correo"**, escribe el **ID del reporte** y el **correo del destinatario**.
3. Pulsa **Enviar**.

### 11.8 El historial de ejecuciones RPA

En la parte inferior de la sección **RPA** se muestra el **historial de ejecuciones**: cada registro en formulario y cada envío de correo, con su fecha, tipo de acción, **estado** (Exitoso/Fallido), la factura asociada y el resultado. Pulsa **"Actualizar"** para refrescar la lista. Este historial te permite confirmar qué se automatizó, cuándo y con qué resultado.

### 11.9 Cómo interpretar los resultados del RPA

- **Mensaje verde / "Exitoso":** la automatización se completó correctamente.
- **Mensaje de aviso (amarillo):** la acción se ejecutó, pero no se completó por una razón conocida —normalmente, **falta de configuración** (URL del formulario o credenciales de correo). No es un fallo del dato ni de tu uso.
- **Mensaje de error (rojo):** ocurrió un problema al comunicarse con el servidor. Revisa tu conexión o vuelve a intentarlo; si persiste, consulta con el administrador.

### 11.10 Buenas prácticas y solución de problemas del RPA

- **Procesa y valida antes de automatizar:** ejecuta el OCR y revisa/corrige los datos **antes** de registrar la factura en el formulario, para que la información enviada sea correcta.
- **Verifica el ID correcto:** confirma que usas el ID de la **factura** (para el formulario) o del **reporte** (para el correo); son numeraciones distintas.
- **Si dice "URL no configurada":** el formulario destino aún no se ha definido en el sistema. Solicita al administrador que configure `RPA_FORM_URL`.
- **Si el correo no se envía:** probablemente falten las credenciales SMTP. Es una configuración del administrador, no un error de uso.
- **Consulta siempre el historial / bitácora:** ante cualquier duda sobre si una automatización se ejecutó, el historial RPA y la Bitácora tienen la respuesta.

---

## 12. Flujo de trabajo recomendado (de principio a fin)

Para procesar una factura desde cero hasta su reporte enviado:

1. **Inicia sesión** en la aplicación.
2. (Si es necesario) **Registra el proveedor** en la sección Proveedores.
3. **Carga la factura** en la sección Facturas (PDF o imagen).
4. **Procesa la factura con OCR** (individual o en lote).
5. **Revisa los datos extraídos** en el detalle y **corrige** lo que haga falta.
6. **Genera un reporte** con los filtros que necesites.
7. **Automatiza con RPA:** registra la factura en el formulario web y/o **envía el reporte por correo**.
8. **Verifica en la Bitácora** que todo quedó registrado correctamente.

---

## 13. Referencia rápida de estados e indicadores

**Estados de factura:** Pendiente (amarillo) · Procesado (verde) · Error (rojo) · Rechazado (rojo).

**Estados de bitácora/RPA:** Exitoso (verde) · Fallido (rojo) · Pendiente (amarillo).

**Validación de datos:** "Validado" (verde) significa que los datos pasaron los controles; "Sin validar" (amarillo) indica que requieren revisión.

**Confianza OCR:** porcentaje (0–100%) que estima qué tan seguro está el sistema de la lectura. Cuanto más alto, mejor; valores bajos sugieren revisar manualmente.

---

## 14. Preguntas frecuentes

**¿Puedo subir varias facturas a la vez?**
Sí. En la ventana de carga puedes arrastrar o seleccionar varios archivos juntos.

**¿Qué formatos de archivo acepta?**
PDF, JPG, JPEG y PNG, hasta 20 MB por archivo.

**El OCR leyó mal un dato, ¿qué hago?**
Abre el detalle de la factura y usa **"Corregir datos"** para ajustarlo manualmente.

**¿Por qué una factura quedó "Rechazada"?**
Porque la validación automática detectó una inconsistencia (por ejemplo, que el total no coincide con subtotal + impuestos). Corrige los datos y vuelve a validarla.

**No veo el botón para crear/eliminar proveedores o procesar en lote.**
Esas acciones requieren rol de **administrador**. Solicita los permisos correspondientes.

**El RPA dice que la URL del formulario no está configurada.**
Es una configuración pendiente del sistema (`RPA_FORM_URL`). Coméntalo con el administrador; no es un error de uso.

**Se cerró mi sesión sola.**
Por seguridad, el acceso expira tras un tiempo. Simplemente vuelve a iniciar sesión.

---

## 15. Glosario

- **OCR:** reconocimiento óptico de caracteres; "lee" texto de imágenes/PDF.
- **Computer Vision:** técnicas que preparan y mejoran la imagen para que el OCR la lea mejor.
- **RPA:** automatización que ejecuta tareas repetitivas (formularios, correos) por el usuario.
- **NIT:** número de identificación tributaria del proveedor.
- **SMTP:** protocolo estándar para el envío de correos electrónicos.
- **Bitácora:** historial de auditoría de todas las operaciones del sistema.
- **Soft-delete (borrado suave):** desactivar un registro sin eliminarlo físicamente.
- **Headless:** ejecución de un navegador sin ventana visible, en segundo plano.

---

*Fin del manual de usuario de SmartInvoice.*

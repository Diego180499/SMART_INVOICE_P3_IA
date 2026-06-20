-- =============================================================================
-- SmartInvoice - Script de Creación de Base de Datos
-- Base de datos: smart_invoice
-- Motor: MySQL 8.x
-- Descripción: Sistema inteligente de procesamiento automatizado de facturas
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CREAR Y SELECCIONAR LA BASE DE DATOS
-- -----------------------------------------------------------------------------

CREATE DATABASE IF NOT EXISTS smart_invoice
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE smart_invoice;

-- -----------------------------------------------------------------------------
-- 2. TABLA: users
-- Almacena los usuarios del sistema con sus credenciales y rol.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id            INT            NOT NULL AUTO_INCREMENT,
    nombre        VARCHAR(150)   NOT NULL                    COMMENT 'Nombre completo del usuario',
    email         VARCHAR(255)   NOT NULL                    COMMENT 'Correo electrónico único, usado como login',
    password_hash VARCHAR(255)   NOT NULL                    COMMENT 'Contraseña hasheada con bcrypt',
    rol           ENUM(
                      'admin',
                      'usuario'
                  )              NOT NULL DEFAULT 'usuario'  COMMENT 'Rol del usuario en el sistema',
    activo        TINYINT(1)     NOT NULL DEFAULT 1          COMMENT 'Soft-delete: 1=activo, 0=inactivo',
    created_at    DATETIME       NOT NULL DEFAULT NOW()      COMMENT 'Fecha de creación del registro',
    updated_at    DATETIME       NOT NULL DEFAULT NOW()
                                 ON UPDATE NOW()             COMMENT 'Fecha de última actualización',

    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_email UNIQUE (email)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Usuarios del sistema SmartInvoice';


-- -----------------------------------------------------------------------------
-- 3. TABLA: proveedores
-- Catálogo de proveedores. CRUD completo desde la API.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS proveedores (
    id          INT          NOT NULL AUTO_INCREMENT,
    nombre      VARCHAR(255) NOT NULL                COMMENT 'Razón social del proveedor',
    nit         VARCHAR(50)  NOT NULL                COMMENT 'Número de identificación tributaria (único)',
    direccion   VARCHAR(500)     NULL DEFAULT NULL   COMMENT 'Dirección fiscal del proveedor',
    telefono    VARCHAR(30)      NULL DEFAULT NULL   COMMENT 'Teléfono de contacto',
    email       VARCHAR(255)     NULL DEFAULT NULL   COMMENT 'Correo electrónico del proveedor',
    activo      TINYINT(1)   NOT NULL DEFAULT 1      COMMENT 'Soft-delete: 1=activo, 0=inactivo',
    created_at  DATETIME     NOT NULL DEFAULT NOW()  COMMENT 'Fecha de creación del registro',
    updated_at  DATETIME     NOT NULL DEFAULT NOW()
                             ON UPDATE NOW()         COMMENT 'Fecha de última actualización',

    CONSTRAINT pk_proveedores PRIMARY KEY (id),
    CONSTRAINT uq_proveedores_nit UNIQUE (nit)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Catálogo de proveedores con operaciones CRUD';


-- -----------------------------------------------------------------------------
-- 4. TABLA: facturas
-- Registro de cada archivo de factura cargado al sistema.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS facturas (
    id                         INT          NOT NULL AUTO_INCREMENT,
    nombre_archivo_original    VARCHAR(255) NOT NULL                    COMMENT 'Nombre del archivo tal como fue subido por el usuario',
    nombre_archivo_almacenado  VARCHAR(255) NOT NULL                    COMMENT 'Nombre UUID asignado en disco para evitar colisiones',
    ruta_archivo               VARCHAR(500) NOT NULL                    COMMENT 'Ruta relativa del archivo en el servidor',
    tipo_archivo               ENUM(
                                   'PDF',
                                   'JPG',
                                   'JPEG',
                                   'PNG'
                               )            NOT NULL                    COMMENT 'Extensión/formato del archivo cargado',
    estado                     ENUM(
                                   'Pendiente',
                                   'Procesado',
                                   'Error',
                                   'Rechazado'
                               )            NOT NULL DEFAULT 'Pendiente' COMMENT 'Estado actual de procesamiento OCR',
    proveedor_id               INT              NULL DEFAULT NULL        COMMENT 'Proveedor identificado tras el procesamiento OCR',
    usuario_id                 INT          NOT NULL                    COMMENT 'Usuario que realizó la carga del archivo',
    created_at                 DATETIME     NOT NULL DEFAULT NOW()      COMMENT 'Fecha y hora de carga de la factura',
    updated_at                 DATETIME     NOT NULL DEFAULT NOW()
                                            ON UPDATE NOW()             COMMENT 'Fecha de última actualización del registro',

    CONSTRAINT pk_facturas          PRIMARY KEY (id),
    CONSTRAINT uq_facturas_archivo  UNIQUE (nombre_archivo_almacenado),
    CONSTRAINT fk_facturas_proveedor FOREIGN KEY (proveedor_id)
        REFERENCES proveedores(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    CONSTRAINT fk_facturas_usuario  FOREIGN KEY (usuario_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Archivos de facturas cargados al sistema para procesamiento';

-- Índices para consultas frecuentes
CREATE INDEX idx_facturas_estado       ON facturas (estado);
CREATE INDEX idx_facturas_usuario      ON facturas (usuario_id);
CREATE INDEX idx_facturas_proveedor    ON facturas (proveedor_id);
CREATE INDEX idx_facturas_created_at   ON facturas (created_at);


-- -----------------------------------------------------------------------------
-- 5. TABLA: datos_extraidos
-- Campos estructurados extraídos por el pipeline OCR de cada factura.
-- Relación 1:1 con la tabla facturas.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS datos_extraidos (
    id                       INT            NOT NULL AUTO_INCREMENT,
    factura_id               INT            NOT NULL                COMMENT 'Factura de origen (relación 1:1)',
    numero_factura           VARCHAR(100)       NULL DEFAULT NULL   COMMENT 'Número o serie de la factura extraído por OCR',
    fecha_factura            DATE               NULL DEFAULT NULL   COMMENT 'Fecha de emisión de la factura',
    nombre_proveedor_ocr     VARCHAR(255)       NULL DEFAULT NULL   COMMENT 'Nombre del proveedor leído por OCR (puede diferir del catálogo)',
    nit_ocr                  VARCHAR(50)        NULL DEFAULT NULL   COMMENT 'NIT leído directamente por OCR del documento',
    subtotal                 DECIMAL(14, 2)     NULL DEFAULT NULL   COMMENT 'Subtotal antes de impuestos (monto extraído)',
    impuestos                DECIMAL(14, 2)     NULL DEFAULT NULL   COMMENT 'Monto de impuestos (IVA u otros) extraído',
    total                    DECIMAL(14, 2)     NULL DEFAULT NULL   COMMENT 'Total de la factura (monto extraído)',
    texto_raw                LONGTEXT           NULL DEFAULT NULL   COMMENT 'Texto completo devuelto por Tesseract OCR sin procesar',
    confianza_ocr            FLOAT              NULL DEFAULT NULL   COMMENT 'Puntuación de confianza promedio de Tesseract (0-100)',
    validado                 TINYINT(1)     NOT NULL DEFAULT 0      COMMENT '1 si la validación automática fue exitosa, 0 si falló o está pendiente',
    observaciones_validacion TEXT               NULL DEFAULT NULL   COMMENT 'Detalle de errores encontrados durante la validación automática',
    created_at               DATETIME       NOT NULL DEFAULT NOW()  COMMENT 'Fecha y hora de la extracción OCR',
    updated_at               DATETIME       NOT NULL DEFAULT NOW()
                                            ON UPDATE NOW()         COMMENT 'Fecha de última modificación (manual o automática)',

    CONSTRAINT pk_datos_extraidos       PRIMARY KEY (id),
    CONSTRAINT uq_datos_extraidos_fk    UNIQUE (factura_id),
    CONSTRAINT fk_datos_factura         FOREIGN KEY (factura_id)
        REFERENCES facturas(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Datos estructurados extraídos por OCR de cada factura (relación 1:1 con facturas)';

-- Índices para búsquedas por campos extraídos
CREATE INDEX idx_datos_numero_factura  ON datos_extraidos (numero_factura);
CREATE INDEX idx_datos_nit_ocr         ON datos_extraidos (nit_ocr);
CREATE INDEX idx_datos_fecha_factura   ON datos_extraidos (fecha_factura);
CREATE INDEX idx_datos_validado        ON datos_extraidos (validado);


-- -----------------------------------------------------------------------------
-- 6. TABLA: bitacora
-- Registro cronológico de todas las operaciones ejecutadas en el sistema.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bitacora (
    id          INT          NOT NULL AUTO_INCREMENT,
    factura_id  INT              NULL DEFAULT NULL   COMMENT 'Factura relacionada con el evento (NULL si el evento no involucra factura)',
    usuario_id  INT              NULL DEFAULT NULL   COMMENT 'Usuario responsable de la acción (NULL para eventos del sistema)',
    fecha_hora  DATETIME     NOT NULL DEFAULT NOW()  COMMENT 'Fecha y hora exacta en que ocurrió el evento',
    accion      VARCHAR(100) NOT NULL                COMMENT 'Tipo de acción: UPLOAD_FACTURA, OCR_PROCESO, EXTRACCION_DATOS, VALIDACION_DATOS, ALMACENAMIENTO_DATOS, GENERACION_REPORTE, ENVIO_EMAIL, RPA_FORMULARIO, LOGIN, CRUD_PROVEEDOR',
    estado      ENUM(
                    'EXITOSO',
                    'FALLIDO',
                    'PENDIENTE'
                )            NOT NULL                COMMENT 'Resultado del evento registrado',
    resultado   TEXT             NULL DEFAULT NULL   COMMENT 'Resumen breve del resultado (ej: "Factura procesada: 3 campos extraídos")',
    detalle     LONGTEXT         NULL DEFAULT NULL   COMMENT 'Detalle técnico completo, stack trace en caso de error o JSON con datos adicionales',
    created_at  DATETIME     NOT NULL DEFAULT NOW()  COMMENT 'Timestamp de inserción del registro (igual a fecha_hora en la mayoría de casos)',

    CONSTRAINT pk_bitacora          PRIMARY KEY (id),
    CONSTRAINT fk_bitacora_factura  FOREIGN KEY (factura_id)
        REFERENCES facturas(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    CONSTRAINT fk_bitacora_usuario  FOREIGN KEY (usuario_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Bitácora de ejecución y auditoría de todas las operaciones del sistema';

-- Índices para consultas frecuentes de auditoría
CREATE INDEX idx_bitacora_factura    ON bitacora (factura_id);
CREATE INDEX idx_bitacora_usuario    ON bitacora (usuario_id);
CREATE INDEX idx_bitacora_accion     ON bitacora (accion);
CREATE INDEX idx_bitacora_estado     ON bitacora (estado);
CREATE INDEX idx_bitacora_fecha_hora ON bitacora (fecha_hora);


-- -----------------------------------------------------------------------------
-- 7. TABLA: reportes
-- Registro de cada reporte administrativo generado y almacenado en disco.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS reportes (
    id               INT          NOT NULL AUTO_INCREMENT,
    nombre           VARCHAR(255) NOT NULL                COMMENT 'Nombre descriptivo del reporte generado',
    tipo             ENUM(
                         'PDF',
                         'EXCEL',
                         'CSV'
                     )            NOT NULL                COMMENT 'Formato del archivo de reporte generado',
    ruta_archivo     VARCHAR(500) NOT NULL                COMMENT 'Ruta relativa del archivo en el servidor',
    usuario_id       INT          NOT NULL                COMMENT 'Usuario que solicitó la generación del reporte',
    fecha_inicio     DATE             NULL DEFAULT NULL   COMMENT 'Filtro aplicado: fecha de inicio del período analizado',
    fecha_fin        DATE             NULL DEFAULT NULL   COMMENT 'Filtro aplicado: fecha de fin del período analizado',
    proveedor_id     INT              NULL DEFAULT NULL   COMMENT 'Filtro aplicado: proveedor específico (NULL = todos)',
    total_facturas   INT              NULL DEFAULT NULL   COMMENT 'Cantidad de facturas incluidas en el reporte',
    created_at       DATETIME     NOT NULL DEFAULT NOW()  COMMENT 'Fecha y hora de generación del reporte',

    CONSTRAINT pk_reportes          PRIMARY KEY (id),
    CONSTRAINT fk_reportes_usuario  FOREIGN KEY (usuario_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_reportes_proveedor FOREIGN KEY (proveedor_id)
        REFERENCES proveedores(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Reportes administrativos generados por el sistema';

-- Índices para reportes
CREATE INDEX idx_reportes_usuario   ON reportes (usuario_id);
CREATE INDEX idx_reportes_tipo      ON reportes (tipo);
CREATE INDEX idx_reportes_created   ON reportes (created_at);


-- =============================================================================
-- 8. DATOS INICIALES (SEED)
-- =============================================================================

-- Desactivar FK checks durante la carga masiva para evitar errores de orden
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 8.1 USUARIOS
-- Contraseña de todos los usuarios en texto plano: Admin1234!
-- Hash bcrypt generado con factor de costo 12.
-- IMPORTANTE: Cambiar las contraseñas tras el primer inicio de sesión.
-- -----------------------------------------------------------------------------

INSERT INTO users (nombre, email, password_hash, rol, activo, created_at, updated_at) VALUES
('Administrador SmartInvoice', 'admin@smartinvoice.com',      '$2b$12$7Wf71kwGqnQ4s8gS0q/C6ept/Hqd3hUXgLDZ4UcPdPS6Tjre76aSC', 'admin',   1, '2025-11-01 08:00:00', '2025-11-01 08:00:00'),
('María García Rodríguez',     'maria.garcia@smartinvoice.com',  '$2b$12$7Wf71kwGqnQ4s8gS0q/C6ept/Hqd3hUXgLDZ4UcPdPS6Tjre76aSC', 'usuario', 1, '2025-11-05 09:15:00', '2025-11-05 09:15:00'),
('Carlos López Mendoza',       'carlos.lopez@smartinvoice.com',  '$2b$12$7Wf71kwGqnQ4s8gS0q/C6ept/Hqd3hUXgLDZ4UcPdPS6Tjre76aSC', 'usuario', 1, '2025-11-10 10:30:00', '2025-11-10 10:30:00'),
('Ana Martínez Herrera',       'ana.martinez@smartinvoice.com',  '$2b$12$7Wf71kwGqnQ4s8gS0q/C6ept/Hqd3hUXgLDZ4UcPdPS6Tjre76aSC', 'admin',   1, '2025-11-12 11:00:00', '2025-11-12 11:00:00'),
('Pedro Hernández Vargas',     'pedro.hernandez@smartinvoice.com','$2b$12$7Wf71kwGqnQ4s8gS0q/C6ept/Hqd3hUXgLDZ4UcPdPS6Tjre76aSC', 'usuario', 1, '2025-11-15 14:20:00', '2025-11-15 14:20:00'),
('Laura Jiménez Castillo',     'laura.jimenez@smartinvoice.com', '$2b$12$7Wf71kwGqnQ4s8gS0q/C6ept/Hqd3hUXgLDZ4UcPdPS6Tjre76aSC', 'usuario', 0, '2025-11-20 08:45:00', '2026-01-10 09:00:00');
-- usuario id=6 inactivo (baja voluntaria), ilustra el soft-delete


-- -----------------------------------------------------------------------------
-- 8.2 PROVEEDORES
-- -----------------------------------------------------------------------------

INSERT INTO proveedores (nombre, nit, direccion, telefono, email, activo, created_at, updated_at) VALUES
('Tecnología Digital S.A.',           '900123456-1', 'Calle 72 # 10-34, Bogotá',          '+57 601 3456789', 'facturacion@tecdigital.com.co',    1, '2025-11-02 08:30:00', '2025-11-02 08:30:00'),
('Suministros Industriales Ltda.',    '800987654-2', 'Carrera 15 # 45-60, Medellín',      '+57 604 2345678', 'contabilidad@sumindustrial.com',   1, '2025-11-02 09:00:00', '2025-11-02 09:00:00'),
('Papelería y Oficina S.A.S.',        '901234567-3', 'Av. 6N # 23-40, Cali',              '+57 602 9876543', 'facturas@papelofi.co',             1, '2025-11-03 10:15:00', '2025-11-03 10:15:00'),
('Servicios Cloud Corp S.A.S.',       '700456789-4', 'Calle 100 # 19-61 Of. 502, Bogotá', '+57 601 7654321', 'billing@cloudcorp.co',             1, '2025-11-03 11:00:00', '2025-11-03 11:00:00'),
('Distribuidora Nacional de Insumos', '890321654-5', 'Zona Industrial, Barranquilla',     '+57 605 1234567', 'cuentasxcobrar@disnacional.com',   1, '2025-11-04 08:00:00', '2025-11-04 08:00:00'),
('Transporte Logístico Express S.A.', '860147258-6', 'Autopista Sur km 12, Bogotá',       '+57 601 8523697', 'facturas@tlogexpress.com',         1, '2025-11-04 09:30:00', '2025-11-04 09:30:00'),
('Marketing Digital Pro Ltda.',       '900741852-7', 'Calle 93 # 11-26, Bogotá',          '+57 601 9637412', 'pagos@mktdigitalpro.co',           1, '2025-11-05 10:00:00', '2025-11-05 10:00:00'),
('Construcciones y Mantenimiento S.A.','810963741-8','Calle 13 # 42-15, Bogotá',          '+57 601 4521369', 'facturacion@conmantenimiento.com', 1, '2025-11-05 11:30:00', '2025-11-05 11:30:00'),
('Servicios de Aseo Empresarial S.A.S','920852963-9','Carrera 30 # 8-30, Bogotá',         '+57 601 7419635', 'admin@aseoempresarial.co',         1, '2025-11-06 08:15:00', '2025-11-06 08:15:00'),
('Editorial Técnica Colombiana Ltda.','870369258-0', 'Calle 57 # 9-78, Bogotá',           '+57 601 3698521', 'facturacion@editecnica.com.co',    0, '2025-11-06 09:00:00', '2026-02-01 10:00:00');
-- proveedor id=10 inactivo (relación comercial terminada)


-- -----------------------------------------------------------------------------
-- 8.3 FACTURAS
-- Orden: usuario primero, proveedor identificado después del OCR.
-- Facturas con estado 'Pendiente' aún no tienen proveedor asignado.
-- -----------------------------------------------------------------------------

INSERT INTO facturas (nombre_archivo_original, nombre_archivo_almacenado, ruta_archivo, tipo_archivo, estado, proveedor_id, usuario_id, created_at, updated_at) VALUES
-- Enero 2026
('factura_tecdigital_enero.pdf',    'a1b2c3d4-e5f6-7890-abcd-ef1234567801.pdf', 'uploads/2026/01/a1b2c3d4-e5f6-7890-abcd-ef1234567801.pdf', 'PDF',  'Procesado', 1, 2, '2026-01-08 09:15:00', '2026-01-08 09:22:00'),
('fact_suministros_012026.pdf',     'b2c3d4e5-f6a7-8901-bcde-f12345678902.pdf', 'uploads/2026/01/b2c3d4e5-f6a7-8901-bcde-f12345678902.pdf', 'PDF',  'Procesado', 2, 3, '2026-01-12 10:30:00', '2026-01-12 10:38:00'),
('recibo_papeleria_cali.jpg',       'c3d4e5f6-a7b8-9012-cdef-123456789003.jpg', 'uploads/2026/01/c3d4e5f6-a7b8-9012-cdef-123456789003.jpg', 'JPG',  'Error',     3, 5, '2026-01-15 14:00:00', '2026-01-15 14:05:00'),
('invoice_cloudcorp_jan.pdf',       'd4e5f6a7-b8c9-0123-def0-234567890104.pdf', 'uploads/2026/01/d4e5f6a7-b8c9-0123-def0-234567890104.pdf', 'PDF',  'Procesado', 4, 1, '2026-01-20 08:45:00', '2026-01-20 08:53:00'),
('scan_insumos_enero.png',          'e5f6a7b8-c9d0-1234-ef01-345678901205.png', 'uploads/2026/01/e5f6a7b8-c9d0-1234-ef01-345678901205.png', 'PNG',  'Pendiente', NULL, 4, '2026-01-28 11:30:00', '2026-01-28 11:30:00'),
-- Febrero 2026
('factura_transporte_0226.pdf',     'f6a7b8c9-d0e1-2345-f012-456789012306.pdf', 'uploads/2026/02/f6a7b8c9-d0e1-2345-f012-456789012306.pdf', 'PDF',  'Procesado', 6, 2, '2026-02-03 09:00:00', '2026-02-03 09:08:00'),
('marketing_feb_factura.jpeg',      'a7b8c9d0-e1f2-3456-0123-567890123407.jpg', 'uploads/2026/02/a7b8c9d0-e1f2-3456-0123-567890123407.jpg', 'JPEG', 'Rechazado', NULL, 5, '2026-02-07 15:20:00', '2026-02-07 15:25:00'),
('fact_construcciones_0226.pdf',    'b8c9d0e1-f2a3-4567-1234-678901234508.pdf', 'uploads/2026/02/b8c9d0e1-f2a3-4567-1234-678901234508.pdf', 'PDF',  'Procesado', 8, 3, '2026-02-11 10:30:00', '2026-02-11 10:39:00'),
('aseo_febrero_2026.pdf',           'c9d0e1f2-a3b4-5678-2345-789012345609.pdf', 'uploads/2026/02/c9d0e1f2-a3b4-5678-2345-789012345609.pdf', 'PDF',  'Procesado', 9, 1, '2026-02-14 09:15:00', '2026-02-14 09:24:00'),
('distribucion_escaneado.png',      'd0e1f2a3-b4c5-6789-3456-890123456710.png', 'uploads/2026/02/d0e1f2a3-b4c5-6789-3456-890123456710.png', 'PNG',  'Pendiente', NULL, 4, '2026-02-20 14:00:00', '2026-02-20 14:00:00'),
-- Marzo 2026
('tecdigital_marzo_2026.pdf',       'e1f2a3b4-c5d6-7890-4567-901234567811.pdf', 'uploads/2026/03/e1f2a3b4-c5d6-7890-4567-901234567811.pdf', 'PDF',  'Procesado', 1, 2, '2026-03-04 08:30:00', '2026-03-04 08:41:00'),
('papeleria_03_2026.pdf',           'f2a3b4c5-d6e7-8901-5678-012345678912.pdf', 'uploads/2026/03/f2a3b4c5-d6e7-8901-5678-012345678912.pdf', 'PDF',  'Error',     NULL, 5, '2026-03-10 11:00:00', '2026-03-10 11:06:00'),
('suministros_marzo.jpg',           'a3b4c5d6-e7f8-9012-6789-123456789013.jpg', 'uploads/2026/03/a3b4c5d6-e7f8-9012-6789-123456789013.jpg', 'JPG',  'Procesado', 2, 3, '2026-03-15 13:45:00', '2026-03-15 13:53:00'),
('cloudcorp_march_inv.pdf',         'b4c5d6e7-f8a9-0123-7890-234567890114.pdf', 'uploads/2026/03/b4c5d6e7-f8a9-0123-7890-234567890114.pdf', 'PDF',  'Procesado', 4, 1, '2026-03-20 09:00:00', '2026-03-20 09:09:00'),
('logistica_express_032026.pdf',    'c5d6e7f8-a9b0-1234-8901-345678901215.pdf', 'uploads/2026/03/c5d6e7f8-a9b0-1234-8901-345678901215.pdf', 'PDF',  'Pendiente', NULL, 4, '2026-03-28 10:30:00', '2026-03-28 10:30:00'),
-- Abril 2026
('mktpro_abril_factura.pdf',        'd6e7f8a9-b0c1-2345-9012-456789012316.pdf', 'uploads/2026/04/d6e7f8a9-b0c1-2345-9012-456789012316.pdf', 'PDF',  'Procesado', 7, 2, '2026-04-02 09:00:00', '2026-04-02 09:11:00'),
('construcciones_abr.pdf',          'e7f8a9b0-c1d2-3456-0123-567890123417.pdf', 'uploads/2026/04/e7f8a9b0-c1d2-3456-0123-567890123417.pdf', 'PDF',  'Procesado', 8, 3, '2026-04-07 10:15:00', '2026-04-07 10:24:00'),
('aseo_abr_2026.pdf',               'f8a9b0c1-d2e3-4567-1234-678901234518.pdf', 'uploads/2026/04/f8a9b0c1-d2e3-4567-1234-678901234518.pdf', 'PDF',  'Rechazado', NULL, 5, '2026-04-09 14:30:00', '2026-04-09 14:36:00'),
('insumos_nac_abril.png',           'a9b0c1d2-e3f4-5678-2345-789012345619.png', 'uploads/2026/04/a9b0c1d2-e3f4-5678-2345-789012345619.png', 'PNG',  'Procesado', 5, 1, '2026-04-15 08:45:00', '2026-04-15 08:55:00'),
('transporte_abril_2026.pdf',       'b0c1d2e3-f4a5-6789-3456-890123456720.pdf', 'uploads/2026/04/b0c1d2e3-f4a5-6789-3456-890123456720.pdf', 'PDF',  'Pendiente', NULL, 4, '2026-04-22 11:00:00', '2026-04-22 11:00:00');


-- -----------------------------------------------------------------------------
-- 8.4 DATOS EXTRAÍDOS (1:1 con facturas)
-- Solo se registran facturas que pasaron por el pipeline OCR
-- (incluyendo las que resultaron en Error, para conservar el texto_raw parcial).
-- Las facturas 'Pendiente' no tienen registro todavía (ids: 5, 10, 15, 20).
-- -----------------------------------------------------------------------------

INSERT INTO datos_extraidos (factura_id, numero_factura, fecha_factura, nombre_proveedor_ocr, nit_ocr, subtotal, impuestos, total, confianza_ocr, validado, observaciones_validacion, created_at, updated_at) VALUES
-- Factura 1 — Procesado, validado
(1,  'FE-2026-00142', '2026-01-06', 'Tecnología Digital S.A.',           '900123456-1', 4500000.00,  855000.00,  5355000.00,  94.7, 1, NULL,                                                            '2026-01-08 09:22:00', '2026-01-08 09:22:00'),
-- Factura 2 — Procesado, validado
(2,  'SI-0089-2026',  '2026-01-10', 'Suministros Industriales Ltda',     '800987654-2', 1230000.00,  233700.00,  1463700.00,  91.3, 1, NULL,                                                            '2026-01-12 10:38:00', '2026-01-12 10:38:00'),
-- Factura 3 — Error OCR (imagen borrosa, extracción parcial)
(3,  NULL,            NULL,         NULL,                                 NULL,          NULL,        NULL,       NULL,        22.1, 0, 'Imagen con resolución insuficiente. No fue posible extraer campos obligatorios. Se recomienda re-escanear el documento a 300 DPI.', '2026-01-15 14:05:00', '2026-01-15 14:05:00'),
-- Factura 4 — Procesado, validado
(4,  'CC-INV-0231',   '2026-01-18', 'Servicios Cloud Corp S.A.S.',       '700456789-4', 8900000.00, 1691000.00, 10591000.00, 97.2, 1, NULL,                                                            '2026-01-20 08:53:00', '2026-01-20 08:53:00'),
-- Factura 6 — Procesado, validado
(6,  'TLE-0056-26',   '2026-02-01', 'Transporte Logístico Express S.A.', '860147258-6',  750000.00,  142500.00,   892500.00,  89.5, 1, NULL,                                                            '2026-02-03 09:08:00', '2026-02-03 09:08:00'),
-- Factura 7 — Rechazado (NIT no coincide con catálogo)
(7,  'MDP-2026-003',  '2026-02-05', 'Marketing Digital Pro',             '900741999-7', 3200000.00,  608000.00,  3808000.00,  85.0, 0, 'NIT extraído (900741999-7) no coincide con el registrado en catálogo (900741852-7). Factura rechazada para revisión manual.', '2026-02-07 15:25:00', '2026-02-07 15:25:00'),
-- Factura 8 — Procesado, validado
(8,  'CM-F-20260211', '2026-02-08', 'Construcciones y Mantenimiento S.A.','810963741-8',12500000.00, 2375000.00, 14875000.00, 92.8, 1, NULL,                                                            '2026-02-11 10:39:00', '2026-02-11 10:39:00'),
-- Factura 9 — Procesado, con observación menor
(9,  'AE-0124-2026',  '2026-02-12', 'Servicios Aseo Empresarial S.A.S', '920852963-9',  980000.00,  186200.00,  1166200.00,  78.4, 0, 'Campo "dirección del receptor" no identificado. Los campos monetarios fueron extraídos correctamente. Se sugiere revisión manual del campo faltante.', '2026-02-14 09:24:00', '2026-02-14 09:24:00'),
-- Factura 11 — Procesado, validado
(11, 'FE-2026-00298', '2026-03-02', 'Tecnología Digital S.A.',           '900123456-1', 6750000.00, 1282500.00,  8032500.00,  96.1, 1, NULL,                                                            '2026-03-04 08:41:00', '2026-03-04 08:41:00'),
-- Factura 12 — Error OCR (archivo corrompido)
(12, NULL,            NULL,         NULL,                                 NULL,          NULL,        NULL,       NULL,        10.3, 0, 'Archivo PDF corrompido. Tesseract no pudo procesar el documento. Se solicita al usuario cargar nuevamente el archivo original.',  '2026-03-10 11:06:00', '2026-03-10 11:06:00'),
-- Factura 13 — Procesado, validado
(13, 'SI-0112-2026',  '2026-03-12', 'Suministros Industriales Ltda.',    '800987654-2', 2100000.00,  399000.00,  2499000.00,  90.6, 1, NULL,                                                            '2026-03-15 13:53:00', '2026-03-15 13:53:00'),
-- Factura 14 — Procesado, validado
(14, 'CC-INV-0387',   '2026-03-18', 'Servicios Cloud Corp S.A.S.',       '700456789-4',11200000.00, 2128000.00, 13328000.00, 95.4, 1, NULL,                                                            '2026-03-20 09:09:00', '2026-03-20 09:09:00'),
-- Factura 16 — Procesado, validado
(16, 'MDP-2026-019',  '2026-04-01', 'Marketing Digital Pro Ltda.',       '900741852-7', 4800000.00,  912000.00,  5712000.00,  93.2, 1, NULL,                                                            '2026-04-02 09:11:00', '2026-04-02 09:11:00'),
-- Factura 17 — Procesado, validado
(17, 'CM-F-20260407', '2026-04-04', 'Construcciones y Mantenimiento S.A.','810963741-8', 9300000.00, 1767000.00, 11067000.00, 91.7, 1, NULL,                                                            '2026-04-07 10:24:00', '2026-04-07 10:24:00'),
-- Factura 18 — Rechazado (total no cuadra con subtotal + impuestos)
(18, 'AE-0198-2026',  '2026-04-07', 'Servicios de Aseo Empresarial',     '920852963-9', 1100000.00,  209000.00,  1400000.00,  81.9, 0, 'Total extraído (1.400.000) no coincide con la suma subtotal + impuestos (1.309.000). Posible error tipográfico en el documento original. Factura rechazada.', '2026-04-09 14:36:00', '2026-04-09 14:36:00'),
-- Factura 19 — Procesado, validado
(19, 'DNI-2026-0541', '2026-04-12', 'Distribuidora Nacional de Insumos', '890321654-5', 3450000.00,  655500.00,  4105500.00,  88.3, 1, NULL,                                                            '2026-04-15 08:55:00', '2026-04-15 08:55:00');


-- -----------------------------------------------------------------------------
-- 8.5 BITÁCORA
-- Cubre: logins, cargas, proceso OCR, extracción, validación,
--        CRUD proveedores, generación de reportes y envío de emails.
-- -----------------------------------------------------------------------------

INSERT INTO bitacora (factura_id, usuario_id, fecha_hora, accion, estado, resultado, detalle) VALUES
-- Logins iniciales
(NULL, 1, '2025-11-01 08:05:00', 'LOGIN', 'EXITOSO', 'Inicio de sesión administrador',         '{"ip":"192.168.1.10","user_agent":"Mozilla/5.0","session_id":"sess_001"}'),
(NULL, 2, '2025-11-05 09:20:00', 'LOGIN', 'EXITOSO', 'Inicio de sesión usuario María García',  '{"ip":"192.168.1.15","user_agent":"Mozilla/5.0","session_id":"sess_002"}'),
(NULL, 3, '2025-11-10 10:35:00', 'LOGIN', 'EXITOSO', 'Inicio de sesión usuario Carlos López',  '{"ip":"192.168.1.22","user_agent":"Chrome/120","session_id":"sess_003"}'),
(NULL, 4, '2025-11-12 11:05:00', 'LOGIN', 'EXITOSO', 'Inicio de sesión admin Ana Martínez',   '{"ip":"192.168.1.30","user_agent":"Firefox/121","session_id":"sess_004"}'),
(NULL, 5, '2025-11-15 14:25:00', 'LOGIN', 'EXITOSO', 'Inicio de sesión usuario Pedro Hdz.',   '{"ip":"192.168.1.18","user_agent":"Edge/120","session_id":"sess_005"}'),
(NULL, 6, '2025-11-20 08:50:00', 'LOGIN', 'EXITOSO', 'Inicio de sesión usuario Laura Jiménez','{"ip":"192.168.1.40","user_agent":"Safari/17","session_id":"sess_006"}'),

-- CRUD Proveedores (alta inicial)
(NULL, 1, '2025-11-02 08:35:00', 'CRUD_PROVEEDOR', 'EXITOSO', 'Proveedor creado: Tecnología Digital S.A.',             '{"accion":"CREATE","proveedor_id":1}'),
(NULL, 1, '2025-11-02 09:05:00', 'CRUD_PROVEEDOR', 'EXITOSO', 'Proveedor creado: Suministros Industriales Ltda.',      '{"accion":"CREATE","proveedor_id":2}'),
(NULL, 1, '2025-11-03 10:20:00', 'CRUD_PROVEEDOR', 'EXITOSO', 'Proveedor creado: Papelería y Oficina S.A.S.',          '{"accion":"CREATE","proveedor_id":3}'),
(NULL, 4, '2025-11-03 11:05:00', 'CRUD_PROVEEDOR', 'EXITOSO', 'Proveedor creado: Servicios Cloud Corp S.A.S.',         '{"accion":"CREATE","proveedor_id":4}'),
(NULL, 4, '2025-11-04 08:10:00', 'CRUD_PROVEEDOR', 'EXITOSO', 'Proveedor creado: Distribuidora Nacional de Insumos',   '{"accion":"CREATE","proveedor_id":5}'),
(NULL, 1, '2025-11-04 09:35:00', 'CRUD_PROVEEDOR', 'EXITOSO', 'Proveedor creado: Transporte Logístico Express S.A.',   '{"accion":"CREATE","proveedor_id":6}'),
(NULL, 4, '2025-11-05 10:05:00', 'CRUD_PROVEEDOR', 'EXITOSO', 'Proveedor creado: Marketing Digital Pro Ltda.',         '{"accion":"CREATE","proveedor_id":7}'),
(NULL, 1, '2025-11-05 11:35:00', 'CRUD_PROVEEDOR', 'EXITOSO', 'Proveedor creado: Construcciones y Mantenimiento S.A.', '{"accion":"CREATE","proveedor_id":8}'),
(NULL, 4, '2025-11-06 08:20:00', 'CRUD_PROVEEDOR', 'EXITOSO', 'Proveedor creado: Servicios de Aseo Empresarial S.A.S.','{\"accion\":\"CREATE\",\"proveedor_id\":9}'),
(NULL, 1, '2025-11-06 09:05:00', 'CRUD_PROVEEDOR', 'EXITOSO', 'Proveedor creado: Editorial Técnica Colombiana Ltda.',  '{"accion":"CREATE","proveedor_id":10}'),
(NULL, 1, '2026-02-01 10:05:00', 'CRUD_PROVEEDOR', 'EXITOSO', 'Proveedor desactivado: Editorial Técnica Colombiana',   '{"accion":"UPDATE","proveedor_id":10,"campo":"activo","valor_anterior":1,"valor_nuevo":0}'),

-- Factura 1 — ciclo completo
(1,  2, '2026-01-08 09:15:00', 'UPLOAD_FACTURA',     'EXITOSO',  'Archivo cargado correctamente',                       '{"archivo":"factura_tecdigital_enero.pdf","tamaño_kb":245}'),
(1,  2, '2026-01-08 09:16:00', 'OCR_PROCESO',        'EXITOSO',  'OCR completado. Confianza: 94.7%',                    '{"motor":"tesseract-v5","paginas":2,"tiempo_ms":3240}'),
(1,  2, '2026-01-08 09:20:00', 'EXTRACCION_DATOS',   'EXITOSO',  '8 campos extraídos correctamente',                    '{"campos_extraidos":["numero_factura","fecha","nit","nombre_proveedor","subtotal","impuestos","total","direccion"]}'),
(1,  2, '2026-01-08 09:22:00', 'VALIDACION_DATOS',   'EXITOSO',  'Validación aprobada. NIT y totales verificados',      '{"validacion":"OK","diferencia_total":0.00}'),
(1,  2, '2026-01-08 09:22:00', 'ALMACENAMIENTO_DATOS','EXITOSO', 'Datos guardados en tabla datos_extraidos',            '{"datos_extraidos_id":1}'),

-- Factura 2 — ciclo completo
(2,  3, '2026-01-12 10:30:00', 'UPLOAD_FACTURA',     'EXITOSO',  'Archivo cargado correctamente',                       '{"archivo":"fact_suministros_012026.pdf","tamaño_kb":312}'),
(2,  3, '2026-01-12 10:32:00', 'OCR_PROCESO',        'EXITOSO',  'OCR completado. Confianza: 91.3%',                    '{"motor":"tesseract-v5","paginas":1,"tiempo_ms":2180}'),
(2,  3, '2026-01-12 10:36:00', 'EXTRACCION_DATOS',   'EXITOSO',  '8 campos extraídos correctamente',                    '{"campos_extraidos":["numero_factura","fecha","nit","nombre_proveedor","subtotal","impuestos","total","telefono"]}'),
(2,  3, '2026-01-12 10:38:00', 'VALIDACION_DATOS',   'EXITOSO',  'Validación aprobada',                                 '{"validacion":"OK","diferencia_total":0.00}'),
(2,  3, '2026-01-12 10:38:00', 'ALMACENAMIENTO_DATOS','EXITOSO', 'Datos guardados en tabla datos_extraidos',            '{"datos_extraidos_id":2}'),

-- Factura 3 — Error OCR
(3,  5, '2026-01-15 14:00:00', 'UPLOAD_FACTURA',     'EXITOSO',  'Archivo cargado correctamente',                       '{"archivo":"recibo_papeleria_cali.jpg","tamaño_kb":98}'),
(3,  5, '2026-01-15 14:02:00', 'OCR_PROCESO',        'FALLIDO',  'Confianza OCR inferior al umbral mínimo (22.1%)',     '{"motor":"tesseract-v5","confianza":22.1,"umbral_minimo":60.0,"error":"LOW_CONFIDENCE"}'),
(3,  5, '2026-01-15 14:05:00', 'EXTRACCION_DATOS',   'FALLIDO',  'No fue posible extraer campos. Imagen de baja calidad.','{"campos_extraidos":[],"motivo":"LOW_RESOLUTION"}'),

-- Factura 4 — ciclo completo
(4,  1, '2026-01-20 08:45:00', 'UPLOAD_FACTURA',     'EXITOSO',  'Archivo cargado correctamente',                       '{"archivo":"invoice_cloudcorp_jan.pdf","tamaño_kb":520}'),
(4,  1, '2026-01-20 08:47:00', 'OCR_PROCESO',        'EXITOSO',  'OCR completado. Confianza: 97.2%',                    '{"motor":"tesseract-v5","paginas":3,"tiempo_ms":5610}'),
(4,  1, '2026-01-20 08:51:00', 'EXTRACCION_DATOS',   'EXITOSO',  '9 campos extraídos correctamente',                    '{"campos_extraidos":["numero_factura","fecha","nit","nombre_proveedor","subtotal","impuestos","total","moneda","orden_compra"]}'),
(4,  1, '2026-01-20 08:53:00', 'VALIDACION_DATOS',   'EXITOSO',  'Validación aprobada',                                 '{"validacion":"OK","diferencia_total":0.00}'),
(4,  1, '2026-01-20 08:53:00', 'ALMACENAMIENTO_DATOS','EXITOSO', 'Datos guardados en tabla datos_extraidos',            '{"datos_extraidos_id":3}'),

-- Factura 5 — solo carga, pendiente de procesamiento
(5,  4, '2026-01-28 11:30:00', 'UPLOAD_FACTURA',     'EXITOSO',  'Archivo cargado. En cola de procesamiento OCR',       '{"archivo":"scan_insumos_enero.png","tamaño_kb":780,"cola_posicion":3}'),

-- Factura 6 — ciclo completo
(6,  2, '2026-02-03 09:00:00', 'UPLOAD_FACTURA',     'EXITOSO',  'Archivo cargado correctamente',                       '{"archivo":"factura_transporte_0226.pdf","tamaño_kb":201}'),
(6,  2, '2026-02-03 09:02:00', 'OCR_PROCESO',        'EXITOSO',  'OCR completado. Confianza: 89.5%',                    '{"motor":"tesseract-v5","paginas":1,"tiempo_ms":1980}'),
(6,  2, '2026-02-03 09:06:00', 'EXTRACCION_DATOS',   'EXITOSO',  '7 campos extraídos',                                  '{"campos_extraidos":["numero_factura","fecha","nit","nombre_proveedor","subtotal","impuestos","total"]}'),
(6,  2, '2026-02-03 09:08:00', 'VALIDACION_DATOS',   'EXITOSO',  'Validación aprobada',                                 '{"validacion":"OK","diferencia_total":0.00}'),
(6,  2, '2026-02-03 09:08:00', 'ALMACENAMIENTO_DATOS','EXITOSO', 'Datos guardados en tabla datos_extraidos',            '{"datos_extraidos_id":5}'),

-- Factura 7 — Rechazado por NIT incorrecto
(7,  5, '2026-02-07 15:20:00', 'UPLOAD_FACTURA',     'EXITOSO',  'Archivo cargado correctamente',                       '{"archivo":"marketing_feb_factura.jpeg","tamaño_kb":156}'),
(7,  5, '2026-02-07 15:21:00', 'OCR_PROCESO',        'EXITOSO',  'OCR completado. Confianza: 85.0%',                    '{"motor":"tesseract-v5","paginas":1,"tiempo_ms":1750}'),
(7,  5, '2026-02-07 15:23:00', 'EXTRACCION_DATOS',   'EXITOSO',  '7 campos extraídos',                                  '{"campos_extraidos":["numero_factura","fecha","nit","nombre_proveedor","subtotal","impuestos","total"]}'),
(7,  5, '2026-02-07 15:25:00', 'VALIDACION_DATOS',   'FALLIDO',  'NIT no coincide con catálogo. Factura rechazada.',    '{"nit_ocr":"900741999-7","nit_catalogo":"900741852-7","accion":"RECHAZADO"}'),

-- Factura 8 — ciclo completo
(8,  3, '2026-02-11 10:30:00', 'UPLOAD_FACTURA',     'EXITOSO',  'Archivo cargado correctamente',                       '{"archivo":"fact_construcciones_0226.pdf","tamaño_kb":415}'),
(8,  3, '2026-02-11 10:32:00', 'OCR_PROCESO',        'EXITOSO',  'OCR completado. Confianza: 92.8%',                    '{"motor":"tesseract-v5","paginas":2,"tiempo_ms":4120}'),
(8,  3, '2026-02-11 10:37:00', 'EXTRACCION_DATOS',   'EXITOSO',  '8 campos extraídos',                                  '{"campos_extraidos":["numero_factura","fecha","nit","nombre_proveedor","subtotal","impuestos","total","concepto"]}'),
(8,  3, '2026-02-11 10:39:00', 'VALIDACION_DATOS',   'EXITOSO',  'Validación aprobada',                                 '{"validacion":"OK","diferencia_total":0.00}'),
(8,  3, '2026-02-11 10:39:00', 'ALMACENAMIENTO_DATOS','EXITOSO', 'Datos guardados en tabla datos_extraidos',            '{"datos_extraidos_id":7}'),

-- Factura 9 — Procesado con observación
(9,  1, '2026-02-14 09:15:00', 'UPLOAD_FACTURA',     'EXITOSO',  'Archivo cargado correctamente',                       '{"archivo":"aseo_febrero_2026.pdf","tamaño_kb":187}'),
(9,  1, '2026-02-14 09:17:00', 'OCR_PROCESO',        'EXITOSO',  'OCR completado. Confianza: 78.4%',                    '{"motor":"tesseract-v5","paginas":1,"tiempo_ms":2060}'),
(9,  1, '2026-02-14 09:21:00', 'EXTRACCION_DATOS',   'EXITOSO',  '6 de 8 campos extraídos. 2 campos incompletos.',      '{"campos_extraidos":["numero_factura","fecha","nit","nombre_proveedor","subtotal","total"],"campos_faltantes":["impuestos","direccion_receptor"]}'),
(9,  1, '2026-02-14 09:24:00', 'VALIDACION_DATOS',   'FALLIDO',  'Validación con observaciones. Requiere revisión.',    '{"observacion":"Campo direccion_receptor no extraído","accion":"PENDIENTE_REVISION"}'),

-- Factura 10 — solo carga
(10, 4, '2026-02-20 14:00:00', 'UPLOAD_FACTURA',     'EXITOSO',  'Archivo cargado. En cola de procesamiento OCR',       '{"archivo":"distribucion_escaneado.png","tamaño_kb":1024,"cola_posicion":2}'),

-- Factura 11 — ciclo completo
(11, 2, '2026-03-04 08:30:00', 'UPLOAD_FACTURA',     'EXITOSO',  'Archivo cargado correctamente',                       '{"archivo":"tecdigital_marzo_2026.pdf","tamaño_kb":302}'),
(11, 2, '2026-03-04 08:32:00', 'OCR_PROCESO',        'EXITOSO',  'OCR completado. Confianza: 96.1%',                    '{"motor":"tesseract-v5","paginas":2,"tiempo_ms":3890}'),
(11, 2, '2026-03-04 08:39:00', 'EXTRACCION_DATOS',   'EXITOSO',  '8 campos extraídos',                                  '{"campos_extraidos":["numero_factura","fecha","nit","nombre_proveedor","subtotal","impuestos","total","orden_compra"]}'),
(11, 2, '2026-03-04 08:41:00', 'VALIDACION_DATOS',   'EXITOSO',  'Validación aprobada',                                 '{"validacion":"OK","diferencia_total":0.00}'),
(11, 2, '2026-03-04 08:41:00', 'ALMACENAMIENTO_DATOS','EXITOSO', 'Datos guardados en tabla datos_extraidos',            '{"datos_extraidos_id":9}'),

-- Factura 12 — Error PDF corrompido
(12, 5, '2026-03-10 11:00:00', 'UPLOAD_FACTURA',     'EXITOSO',  'Archivo cargado correctamente',                       '{"archivo":"papeleria_03_2026.pdf","tamaño_kb":450}'),
(12, 5, '2026-03-10 11:03:00', 'OCR_PROCESO',        'FALLIDO',  'Error al procesar PDF. Archivo posiblemente corrompido.','{"motor":"tesseract-v5","error":"PDF_PARSE_ERROR","stack":"PdfException: Invalid xref table at offset 0x3F8C"}'),
(12, 5, '2026-03-10 11:06:00', 'EXTRACCION_DATOS',   'FALLIDO',  'Extracción abortada por fallo en OCR.',               '{"motivo":"OCR_FAILED"}'),

-- Factura 13 — ciclo completo
(13, 3, '2026-03-15 13:45:00', 'UPLOAD_FACTURA',     'EXITOSO',  'Archivo cargado correctamente',                       '{"archivo":"suministros_marzo.jpg","tamaño_kb":210}'),
(13, 3, '2026-03-15 13:47:00', 'OCR_PROCESO',        'EXITOSO',  'OCR completado. Confianza: 90.6%',                    '{"motor":"tesseract-v5","paginas":1,"tiempo_ms":2300}'),
(13, 3, '2026-03-15 13:51:00', 'EXTRACCION_DATOS',   'EXITOSO',  '8 campos extraídos',                                  '{"campos_extraidos":["numero_factura","fecha","nit","nombre_proveedor","subtotal","impuestos","total","contacto"]}'),
(13, 3, '2026-03-15 13:53:00', 'VALIDACION_DATOS',   'EXITOSO',  'Validación aprobada',                                 '{"validacion":"OK","diferencia_total":0.00}'),
(13, 3, '2026-03-15 13:53:00', 'ALMACENAMIENTO_DATOS','EXITOSO', 'Datos guardados en tabla datos_extraidos',            '{"datos_extraidos_id":11}'),

-- Factura 14 — ciclo completo
(14, 1, '2026-03-20 09:00:00', 'UPLOAD_FACTURA',     'EXITOSO',  'Archivo cargado correctamente',                       '{"archivo":"cloudcorp_march_inv.pdf","tamaño_kb":598}'),
(14, 1, '2026-03-20 09:02:00', 'OCR_PROCESO',        'EXITOSO',  'OCR completado. Confianza: 95.4%',                    '{"motor":"tesseract-v5","paginas":3,"tiempo_ms":6020}'),
(14, 1, '2026-03-20 09:07:00', 'EXTRACCION_DATOS',   'EXITOSO',  '9 campos extraídos',                                  '{"campos_extraidos":["numero_factura","fecha","nit","nombre_proveedor","subtotal","impuestos","total","moneda","periodo_servicio"]}'),
(14, 1, '2026-03-20 09:09:00', 'VALIDACION_DATOS',   'EXITOSO',  'Validación aprobada',                                 '{"validacion":"OK","diferencia_total":0.00}'),
(14, 1, '2026-03-20 09:09:00', 'ALMACENAMIENTO_DATOS','EXITOSO', 'Datos guardados en tabla datos_extraidos',            '{"datos_extraidos_id":12}'),

-- Factura 15 — solo carga
(15, 4, '2026-03-28 10:30:00', 'UPLOAD_FACTURA',     'EXITOSO',  'Archivo cargado. En cola de procesamiento OCR',       '{"archivo":"logistica_express_032026.pdf","tamaño_kb":265,"cola_posicion":1}'),

-- Facturas 16-20 (Abril) — resumen de eventos
(16, 2, '2026-04-02 09:00:00', 'UPLOAD_FACTURA',     'EXITOSO',  'Archivo cargado correctamente',                       '{"archivo":"mktpro_abril_factura.pdf","tamaño_kb":330}'),
(16, 2, '2026-04-02 09:02:00', 'OCR_PROCESO',        'EXITOSO',  'OCR completado. Confianza: 93.2%',                    '{"motor":"tesseract-v5","paginas":2,"tiempo_ms":3760}'),
(16, 2, '2026-04-02 09:09:00', 'EXTRACCION_DATOS',   'EXITOSO',  '8 campos extraídos',                                  '{"campos_extraidos":["numero_factura","fecha","nit","nombre_proveedor","subtotal","impuestos","total","servicio"]}'),
(16, 2, '2026-04-02 09:11:00', 'VALIDACION_DATOS',   'EXITOSO',  'Validación aprobada',                                 '{"validacion":"OK","diferencia_total":0.00}'),
(16, 2, '2026-04-02 09:11:00', 'ALMACENAMIENTO_DATOS','EXITOSO', 'Datos guardados en tabla datos_extraidos',            '{"datos_extraidos_id":13}'),
(17, 3, '2026-04-07 10:15:00', 'UPLOAD_FACTURA',     'EXITOSO',  'Archivo cargado correctamente',                       '{"archivo":"construcciones_abr.pdf","tamaño_kb":488}'),
(17, 3, '2026-04-07 10:17:00', 'OCR_PROCESO',        'EXITOSO',  'OCR completado. Confianza: 91.7%',                    '{"motor":"tesseract-v5","paginas":2,"tiempo_ms":4450}'),
(17, 3, '2026-04-07 10:22:00', 'EXTRACCION_DATOS',   'EXITOSO',  '8 campos extraídos',                                  '{"campos_extraidos":["numero_factura","fecha","nit","nombre_proveedor","subtotal","impuestos","total","concepto"]}'),
(17, 3, '2026-04-07 10:24:00', 'VALIDACION_DATOS',   'EXITOSO',  'Validación aprobada',                                 '{"validacion":"OK","diferencia_total":0.00}'),
(17, 3, '2026-04-07 10:24:00', 'ALMACENAMIENTO_DATOS','EXITOSO', 'Datos guardados en tabla datos_extraidos',            '{"datos_extraidos_id":14}'),
(18, 5, '2026-04-09 14:30:00', 'UPLOAD_FACTURA',     'EXITOSO',  'Archivo cargado correctamente',                       '{"archivo":"aseo_abr_2026.pdf","tamaño_kb":195}'),
(18, 5, '2026-04-09 14:32:00', 'OCR_PROCESO',        'EXITOSO',  'OCR completado. Confianza: 81.9%',                    '{"motor":"tesseract-v5","paginas":1,"tiempo_ms":2100}'),
(18, 5, '2026-04-09 14:34:00', 'EXTRACCION_DATOS',   'EXITOSO',  '7 campos extraídos',                                  '{"campos_extraidos":["numero_factura","fecha","nit","nombre_proveedor","subtotal","impuestos","total"]}'),
(18, 5, '2026-04-09 14:36:00', 'VALIDACION_DATOS',   'FALLIDO',  'Total no cuadra. Factura rechazada.',                 '{"subtotal":1100000,"impuestos":209000,"suma":1309000,"total_ocr":1400000,"diferencia":91000}'),
(19, 1, '2026-04-15 08:45:00', 'UPLOAD_FACTURA',     'EXITOSO',  'Archivo cargado correctamente',                       '{"archivo":"insumos_nac_abril.png","tamaño_kb":840}'),
(19, 1, '2026-04-15 08:47:00', 'OCR_PROCESO',        'EXITOSO',  'OCR completado. Confianza: 88.3%',                    '{"motor":"tesseract-v5","paginas":1,"tiempo_ms":2680}'),
(19, 1, '2026-04-15 08:52:00', 'EXTRACCION_DATOS',   'EXITOSO',  '8 campos extraídos',                                  '{"campos_extraidos":["numero_factura","fecha","nit","nombre_proveedor","subtotal","impuestos","total","unidades"]}'),
(19, 1, '2026-04-15 08:55:00', 'VALIDACION_DATOS',   'EXITOSO',  'Validación aprobada',                                 '{"validacion":"OK","diferencia_total":0.00}'),
(19, 1, '2026-04-15 08:55:00', 'ALMACENAMIENTO_DATOS','EXITOSO', 'Datos guardados en tabla datos_extraidos',            '{"datos_extraidos_id":15}'),
(20, 4, '2026-04-22 11:00:00', 'UPLOAD_FACTURA',     'EXITOSO',  'Archivo cargado. En cola de procesamiento OCR',       '{"archivo":"transporte_abril_2026.pdf","tamaño_kb":273,"cola_posicion":1}'),

-- Envío de emails de notificación
(NULL, 1, '2026-02-01 09:30:00', 'ENVIO_EMAIL', 'EXITOSO', 'Resumen mensual enero enviado a administradores',     '{"destinatarios":["admin@smartinvoice.com","ana.martinez@smartinvoice.com"],"asunto":"Resumen Enero 2026","facturas_procesadas":4}'),
(NULL, 1, '2026-03-03 09:15:00', 'ENVIO_EMAIL', 'EXITOSO', 'Resumen mensual febrero enviado a administradores',   '{"destinatarios":["admin@smartinvoice.com","ana.martinez@smartinvoice.com"],"asunto":"Resumen Febrero 2026","facturas_procesadas":4}'),
(NULL, 1, '2026-04-01 09:00:00', 'ENVIO_EMAIL', 'EXITOSO', 'Resumen mensual marzo enviado a administradores',     '{"destinatarios":["admin@smartinvoice.com","ana.martinez@smartinvoice.com"],"asunto":"Resumen Marzo 2026","facturas_procesadas":4}'),
(7,  4, '2026-02-07 15:26:00', 'ENVIO_EMAIL',   'EXITOSO', 'Notificación de rechazo enviada al usuario',         '{"destinatario":"pedro.hernandez@smartinvoice.com","asunto":"Factura rechazada: NIT incorrecto","factura_id":7}'),
(18, 4, '2026-04-09 14:37:00', 'ENVIO_EMAIL',   'EXITOSO', 'Notificación de rechazo enviada al usuario',         '{"destinatario":"pedro.hernandez@smartinvoice.com","asunto":"Factura rechazada: total no cuadra","factura_id":18}'),

-- Generación de reportes
(NULL, 1, '2026-02-01 10:00:00', 'GENERACION_REPORTE', 'EXITOSO', 'Reporte mensual enero generado en PDF',           '{"reporte_id":1,"tipo":"PDF","facturas":4}'),
(NULL, 4, '2026-02-01 10:30:00', 'GENERACION_REPORTE', 'EXITOSO', 'Reporte mensual enero generado en Excel',         '{"reporte_id":2,"tipo":"EXCEL","facturas":4}'),
(NULL, 1, '2026-03-03 09:00:00', 'GENERACION_REPORTE', 'EXITOSO', 'Reporte mensual febrero generado en PDF',         '{"reporte_id":3,"tipo":"PDF","facturas":4}'),
(NULL, 1, '2026-04-01 08:45:00', 'GENERACION_REPORTE', 'EXITOSO', 'Reporte mensual marzo generado en PDF',           '{"reporte_id":4,"tipo":"PDF","facturas":4}'),
(NULL, 4, '2026-04-01 09:10:00', 'GENERACION_REPORTE', 'EXITOSO', 'Reporte proveedor Tecnología Digital generado',   '{"reporte_id":5,"tipo":"CSV","proveedor_id":1,"facturas":2}'),
(NULL, 4, '2026-04-22 09:00:00', 'GENERACION_REPORTE', 'EXITOSO', 'Reporte acumulado Q1 2026 generado en Excel',     '{"reporte_id":6,"tipo":"EXCEL","facturas":12}');


-- -----------------------------------------------------------------------------
-- 8.6 REPORTES
-- -----------------------------------------------------------------------------

INSERT INTO reportes (nombre, tipo, ruta_archivo, usuario_id, fecha_inicio, fecha_fin, proveedor_id, total_facturas, created_at) VALUES
('Reporte Mensual Enero 2026',              'PDF',   'reportes/2026/01/reporte_enero_2026.pdf',           1, '2026-01-01', '2026-01-31', NULL, 4,  '2026-02-01 10:00:00'),
('Reporte Mensual Enero 2026 - Excel',      'EXCEL', 'reportes/2026/01/reporte_enero_2026.xlsx',          4, '2026-01-01', '2026-01-31', NULL, 4,  '2026-02-01 10:30:00'),
('Reporte Mensual Febrero 2026',            'PDF',   'reportes/2026/02/reporte_febrero_2026.pdf',         1, '2026-02-01', '2026-02-28', NULL, 5,  '2026-03-03 09:00:00'),
('Reporte Mensual Marzo 2026',              'PDF',   'reportes/2026/03/reporte_marzo_2026.pdf',           1, '2026-03-01', '2026-03-31', NULL, 5,  '2026-04-01 08:45:00'),
('Reporte Proveedor - Tecnología Digital',  'CSV',   'reportes/2026/04/reporte_tecdigital_q1.csv',        4, '2026-01-01', '2026-03-31', 1,    2,  '2026-04-01 09:10:00'),
('Reporte Acumulado Q1 2026',               'EXCEL', 'reportes/2026/04/reporte_acumulado_q1_2026.xlsx',   4, '2026-01-01', '2026-03-31', NULL, 12, '2026-04-22 09:00:00'),
('Reporte Proveedor - Cloud Corp Q1',       'PDF',   'reportes/2026/04/reporte_cloudcorp_q1.pdf',         1, '2026-01-01', '2026-03-31', 4,    2,  '2026-04-22 09:30:00'),
('Reporte Facturas con Error - Q1 2026',    'CSV',   'reportes/2026/04/reporte_errores_q1.csv',           4, '2026-01-01', '2026-03-31', NULL, 4,  '2026-04-22 10:00:00');


-- Reactivar FK checks al finalizar la carga
SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- RESUMEN DE LA ESTRUCTURA
-- =============================================================================
--
-- Tablas creadas:
--   1. users          — Usuarios del sistema (autenticación y autorización)
--   2. proveedores    — Catálogo de proveedores (CRUD completo)
--   3. facturas       — Archivos de facturas cargados
--   4. datos_extraidos — Campos extraídos por OCR (1:1 con facturas)
--   5. bitacora       — Bitácora de auditoría de todas las operaciones
--   6. reportes       — Reportes administrativos generados
--
-- Relaciones:
--   users        (1) ──< facturas       (N)   [usuario que carga]
--   users        (1) ──< bitacora       (N)   [usuario responsable]
--   users        (1) ──< reportes       (N)   [usuario que genera]
--   proveedores  (1) ──< facturas       (N)   [proveedor identificado]
--   proveedores  (1) ──< reportes       (N)   [filtro de reporte]
--   facturas     (1) ──── datos_extraidos (1) [resultado OCR]
--   facturas     (1) ──< bitacora       (N)   [historial de eventos]
--
-- Seed data:
--   users            →  6 registros  (1 admin original + 4 usuarios + 1 inactivo)
--   proveedores      → 10 registros  (9 activos + 1 inactivo)
--   facturas         → 20 registros  (distribuidas en ene-abr 2026)
--   datos_extraidos  → 16 registros  (1:1 con facturas procesadas/con error/rechazadas)
--   bitacora         → 90+ registros (logins, uploads, OCR, validaciones, reportes, emails)
--   reportes         →  8 registros  (mensuales, por proveedor, acumulados)
--
-- =============================================================================

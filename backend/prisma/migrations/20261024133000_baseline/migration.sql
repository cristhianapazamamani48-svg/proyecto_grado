-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'DOCENTE', 'ESTUDIANTE');

-- CreateEnum
CREATE TYPE "TipoPlan" AS ENUM ('GRATUITO', 'MAESTRO_PRO', 'BASICO', 'INSTITUCIONAL');

-- CreateEnum
CREATE TYPE "EstadoSuscripcion" AS ENUM ('ACTIVA', 'EN_PERIODO_GRACIA', 'CANCELADA', 'SUSPENDIDA_POR_PAGO', 'INCOMPLETA');

-- CreateEnum
CREATE TYPE "ProveedorPago" AS ENUM ('MOCK_SANDBOX', 'MERCADOPAGO', 'PAYPAL', 'LIVEES');

-- CreateEnum
CREATE TYPE "EstadoPagoTransaccion" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'REEMBOLSADO');

-- CreateEnum
CREATE TYPE "EstadoGeneral" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "EstadoEvaluacion" AS ENUM ('BORRADOR', 'PUBLICADA', 'ARCHIVADA');

-- CreateEnum
CREATE TYPE "TipoPregunta" AS ENUM ('OPCION_MULTIPLE', 'SELECCION_MULTIPLE', 'VERDADERO_FALSO', 'COMPLETAR', 'ABIERTA');

-- CreateEnum
CREATE TYPE "ModoCalificacionEspacio" AS ENUM ('EXACTA', 'CONTIENE');

-- CreateEnum
CREATE TYPE "ModoInicioSesion" AS ENUM ('INMEDIATO', 'PROGRAMADO', 'POR_PARTICIPANTE');

-- CreateEnum
CREATE TYPE "EstadoSesion" AS ENUM ('PENDIENTE', 'ACTIVA', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "EstadoParticipante" AS ENUM ('EN_PROGRESO', 'FINALIZADO', 'VENCIDO');

-- CreateEnum
CREATE TYPE "TipoEventoMonitoreo" AS ENUM ('CAMBIO_PESTANA', 'CLICK_DERECHO', 'COPIAR', 'PEGAR', 'REDIMENSIONAR', 'PERDIDA_FOCO');

-- CreateEnum
CREATE TYPE "EstadoRevisionIa" AS ENUM ('PENDIENTE', 'SUGERIDA', 'ACEPTADA', 'MODIFICADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "EstadoInvitacion" AS ENUM ('PENDIENTE', 'ACEPTADA', 'EXPIRADA', 'REVOCADA');

-- CreateEnum
CREATE TYPE "EstadoMembresia" AS ENUM ('ACTIVO', 'PENDIENTE_APROBACION', 'INACTIVO');

-- CreateTable
CREATE TABLE "organizacion" (
    "id_organizacion" SERIAL NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "plan" "TipoPlan" NOT NULL DEFAULT 'GRATUITO',
    "estado" "EstadoGeneral" NOT NULL DEFAULT 'ACTIVO',
    "limite_docentes" INTEGER NOT NULL DEFAULT 5,
    "limite_estudiantes" INTEGER NOT NULL DEFAULT 100,
    "limite_evaluaciones" INTEGER NOT NULL DEFAULT 20,
    "limite_correcciones_ia_mes" INTEGER NOT NULL DEFAULT 10,
    "dias_caducidad_evaluacion" INTEGER NOT NULL DEFAULT 20,
    "es_contenido_privado" BOOLEAN NOT NULL DEFAULT false,
    "ia_habilitada" BOOLEAN NOT NULL DEFAULT true,
    "codigo_acceso" VARCHAR(20),
    "codigo_acceso_activo" BOOLEAN NOT NULL DEFAULT false,
    "rol_predeterminado_codigo" "RolUsuario" NOT NULL DEFAULT 'DOCENTE',
    "aprobacion_requerida" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizacion_pkey" PRIMARY KEY ("id_organizacion")
);

-- CreateTable
CREATE TABLE "invitacion_organizacion" (
    "id_invitacion" SERIAL NOT NULL,
    "id_organizacion" INTEGER NOT NULL,
    "id_invitador" INTEGER NOT NULL,
    "correo_invitado" VARCHAR(150) NOT NULL,
    "rol_asignado" "RolUsuario" NOT NULL DEFAULT 'DOCENTE',
    "token" VARCHAR(128) NOT NULL,
    "estado" "EstadoInvitacion" NOT NULL DEFAULT 'PENDIENTE',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_expiracion" TIMESTAMP(3) NOT NULL,
    "fecha_uso" TIMESTAMP(3),

    CONSTRAINT "invitacion_organizacion_pkey" PRIMARY KEY ("id_invitacion")
);

-- CreateTable
CREATE TABLE "membresia" (
    "id_membresia" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_organizacion" INTEGER NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "estado" "EstadoMembresia" NOT NULL DEFAULT 'ACTIVO',
    "metodo_ingreso" VARCHAR(30) NOT NULL DEFAULT 'REGISTRO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membresia_pkey" PRIMARY KEY ("id_membresia")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" SERIAL NOT NULL,
    "id_organizacion_actual" INTEGER,
    "nombre" VARCHAR(100) NOT NULL,
    "apellido" VARCHAR(100) NOT NULL,
    "correo" VARCHAR(150) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'DOCENTE',
    "estado" "EstadoGeneral" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "estudiante" (
    "id_estudiante" SERIAL NOT NULL,
    "id_organizacion" INTEGER,
    "nombre" VARCHAR(100) NOT NULL,
    "apellido" VARCHAR(100) NOT NULL,
    "correo" VARCHAR(150) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "estado" "EstadoGeneral" NOT NULL DEFAULT 'ACTIVO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estudiante_pkey" PRIMARY KEY ("id_estudiante")
);

-- CreateTable
CREATE TABLE "evaluacion" (
    "id_evaluacion" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_organizacion" INTEGER,
    "nombre" VARCHAR(200) NOT NULL,
    "descripcion" TEXT,
    "estado" "EstadoEvaluacion" NOT NULL DEFAULT 'BORRADOR',
    "tiempo_total" INTEGER,
    "tiempo_por_pregunta" INTEGER,
    "permitir_retroceder" BOOLEAN NOT NULL DEFAULT true,
    "permitir_modificar" BOOLEAN NOT NULL DEFAULT true,
    "permitir_dejar_en_blanco" BOOLEAN NOT NULL DEFAULT true,
    "mostrar_resultados" BOOLEAN NOT NULL DEFAULT true,
    "mostrar_respuestas" BOOLEAN NOT NULL DEFAULT false,
    "permitir_revision" BOOLEAN NOT NULL DEFAULT false,
    "aleatorizar_preguntas" BOOLEAN NOT NULL DEFAULT false,
    "aleatorizar_opciones" BOOLEAN NOT NULL DEFAULT false,
    "detectar_cambio_pestana" BOOLEAN NOT NULL DEFAULT false,
    "detectar_click_derecho" BOOLEAN NOT NULL DEFAULT false,
    "detectar_copiar" BOOLEAN NOT NULL DEFAULT false,
    "detectar_pegar" BOOLEAN NOT NULL DEFAULT false,
    "detectar_redimensionar" BOOLEAN NOT NULL DEFAULT false,
    "modo_inicio" "ModoInicioSesion" NOT NULL DEFAULT 'INMEDIATO',
    "fecha_inicio" TIMESTAMP(3),
    "fecha_fin" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluacion_pkey" PRIMARY KEY ("id_evaluacion")
);

-- CreateTable
CREATE TABLE "pregunta" (
    "id_pregunta" SERIAL NOT NULL,
    "id_evaluacion" INTEGER NOT NULL,
    "tipo" "TipoPregunta" NOT NULL,
    "enunciado" TEXT NOT NULL,
    "imagen" VARCHAR(255),
    "puntaje" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "pregunta_pkey" PRIMARY KEY ("id_pregunta")
);

-- CreateTable
CREATE TABLE "opcion_respuesta" (
    "id_opcion" SERIAL NOT NULL,
    "id_pregunta" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "es_correcta" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "opcion_respuesta_pkey" PRIMARY KEY ("id_opcion")
);

-- CreateTable
CREATE TABLE "espacio_completar" (
    "id_espacio" SERIAL NOT NULL,
    "id_pregunta" INTEGER NOT NULL,
    "numero_espacio" INTEGER NOT NULL,
    "ignorar_mayusculas" BOOLEAN NOT NULL DEFAULT true,
    "modo_calificacion" "ModoCalificacionEspacio" NOT NULL DEFAULT 'EXACTA',
    "calificacion_parcial" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "espacio_completar_pkey" PRIMARY KEY ("id_espacio")
);

-- CreateTable
CREATE TABLE "respuesta_valida" (
    "id_respuesta_valida" SERIAL NOT NULL,
    "id_espacio" INTEGER NOT NULL,
    "respuesta" VARCHAR(255) NOT NULL,

    CONSTRAINT "respuesta_valida_pkey" PRIMARY KEY ("id_respuesta_valida")
);

-- CreateTable
CREATE TABLE "sesion" (
    "id_sesion" SERIAL NOT NULL,
    "id_evaluacion" INTEGER NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "estado" "EstadoSesion" NOT NULL DEFAULT 'PENDIENTE',
    "fecha_inicio" TIMESTAMP(3),
    "fecha_fin" TIMESTAMP(3),

    CONSTRAINT "sesion_pkey" PRIMARY KEY ("id_sesion")
);

-- CreateTable
CREATE TABLE "participante" (
    "id_participante" SERIAL NOT NULL,
    "id_sesion" INTEGER NOT NULL,
    "id_estudiante" INTEGER,
    "nombre" VARCHAR(200) NOT NULL,
    "token_acceso" VARCHAR(64),
    "fecha_ingreso" TIMESTAMP(3),
    "fecha_finalizacion" TIMESTAMP(3),
    "puntaje_total" DECIMAL(6,2),
    "porcentaje" DECIMAL(6,2),
    "estado" "EstadoParticipante" NOT NULL DEFAULT 'EN_PROGRESO',

    CONSTRAINT "participante_pkey" PRIMARY KEY ("id_participante")
);

-- CreateTable
CREATE TABLE "respuesta" (
    "id_respuesta" SERIAL NOT NULL,
    "id_participante" INTEGER NOT NULL,
    "id_pregunta" INTEGER NOT NULL,
    "respuesta_texto" TEXT,
    "puntaje" DECIMAL(6,2),
    "es_correcta" BOOLEAN,
    "comentario_ia" TEXT,
    "puntaje_sugerido_ia" DECIMAL(6,2),
    "confianza_ia" DECIMAL(4,3),
    "justificacion_ia" TEXT,
    "fortalezas_ia" TEXT,
    "faltantes_ia" TEXT,
    "modelo_ia" VARCHAR(50),
    "fecha_analisis_ia" TIMESTAMP(3),
    "estado_revision_ia" "EstadoRevisionIa" NOT NULL DEFAULT 'PENDIENTE',
    "version_prompt" VARCHAR(20),
    "corregido_docente" BOOLEAN NOT NULL DEFAULT false,
    "comentario_docente" TEXT,
    "id_usuario_corrector" INTEGER,
    "fecha_correccion" TIMESTAMP(3),

    CONSTRAINT "respuesta_pkey" PRIMARY KEY ("id_respuesta")
);

-- CreateTable
CREATE TABLE "respuesta_seleccionada" (
    "id_respuesta_seleccionada" SERIAL NOT NULL,
    "id_respuesta" INTEGER NOT NULL,
    "id_opcion" INTEGER NOT NULL,

    CONSTRAINT "respuesta_seleccionada_pkey" PRIMARY KEY ("id_respuesta_seleccionada")
);

-- CreateTable
CREATE TABLE "evento_monitoreo" (
    "id_evento" SERIAL NOT NULL,
    "id_participante" INTEGER NOT NULL,
    "tipo" "TipoEventoMonitoreo" NOT NULL,
    "detalle" TEXT,
    "fecha_evento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_monitoreo_pkey" PRIMARY KEY ("id_evento")
);

-- CreateTable
CREATE TABLE "auditoria_calificacion" (
    "id_auditoria" SERIAL NOT NULL,
    "id_respuesta" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "puntaje_anterior" DECIMAL(6,2),
    "puntaje_nuevo" DECIMAL(6,2) NOT NULL,
    "comentario_anterior" TEXT,
    "comentario_nuevo" TEXT,
    "estado_revision_anterior" "EstadoRevisionIa",
    "estado_revision_nuevo" "EstadoRevisionIa" NOT NULL,
    "origen" VARCHAR(50) NOT NULL,
    "fecha_accion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_calificacion_pkey" PRIMARY KEY ("id_auditoria")
);

-- CreateTable
CREATE TABLE "uso_ia_log" (
    "id_log" SERIAL NOT NULL,
    "id_organizacion" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "proveedor" VARCHAR(50) NOT NULL,
    "tokens_utilizados" INTEGER NOT NULL DEFAULT 0,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uso_ia_log_pkey" PRIMARY KEY ("id_log")
);

-- CreateTable
CREATE TABLE "auditoria_administrativa" (
    "id_auditoria_admin" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "accion" VARCHAR(100) NOT NULL,
    "recurso_afectado" VARCHAR(100) NOT NULL,
    "id_recurso" VARCHAR(50),
    "valores_anteriores" TEXT,
    "valores_nuevos" TEXT,
    "ip_origen" VARCHAR(45),
    "user_agent" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_administrativa_pkey" PRIMARY KEY ("id_auditoria_admin")
);

-- CreateTable
CREATE TABLE "suscripcion_organizacion" (
    "id_suscripcion" SERIAL NOT NULL,
    "id_organizacion" INTEGER NOT NULL,
    "plan" "TipoPlan" NOT NULL DEFAULT 'GRATUITO',
    "estado" "EstadoSuscripcion" NOT NULL DEFAULT 'ACTIVA',
    "proveedor" "ProveedorPago" NOT NULL DEFAULT 'MOCK_SANDBOX',
    "id_suscripcion_externa" VARCHAR(100),
    "monto" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "moneda" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "monto_local" DECIMAL(10,2),
    "moneda_local" VARCHAR(10) DEFAULT 'BOB',
    "fecha_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_fin_periodo" TIMESTAMP(3),
    "fecha_proximo_cobro" TIMESTAMP(3),
    "fecha_fin_gracia" TIMESTAMP(3),
    "auto_renovar" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suscripcion_organizacion_pkey" PRIMARY KEY ("id_suscripcion")
);

-- CreateTable
CREATE TABLE "transaccion_pago" (
    "id_transaccion" SERIAL NOT NULL,
    "id_suscripcion" INTEGER,
    "id_organizacion" INTEGER NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "moneda" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "monto_local" DECIMAL(10,2),
    "moneda_local" VARCHAR(10) DEFAULT 'BOB',
    "estado" "EstadoPagoTransaccion" NOT NULL DEFAULT 'PENDIENTE',
    "plan" "TipoPlan" NOT NULL DEFAULT 'MAESTRO_PRO',
    "proveedor" "ProveedorPago" NOT NULL DEFAULT 'MOCK_SANDBOX',
    "id_transaccion_externa" VARCHAR(100),
    "metodo_pago" VARCHAR(50),
    "url_checkout" TEXT,
    "firma_webhook" VARCHAR(255),
    "detalle_error" TEXT,
    "fecha_transaccion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaccion_pago_pkey" PRIMARY KEY ("id_transaccion")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizacion_slug_key" ON "organizacion"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizacion_codigo_acceso_key" ON "organizacion"("codigo_acceso");

-- CreateIndex
CREATE UNIQUE INDEX "invitacion_organizacion_token_key" ON "invitacion_organizacion"("token");

-- CreateIndex
CREATE UNIQUE INDEX "uq_usuario_organizacion" ON "membresia"("id_usuario", "id_organizacion");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "estudiante_correo_key" ON "estudiante"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "uq_pregunta_orden" ON "pregunta"("id_evaluacion", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "uq_espacio_numero" ON "espacio_completar"("id_pregunta", "numero_espacio");

-- CreateIndex
CREATE UNIQUE INDEX "sesion_codigo_key" ON "sesion"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "uq_participante_sesion_estudiante" ON "participante"("id_sesion", "id_estudiante");

-- CreateIndex
CREATE UNIQUE INDEX "uq_respuesta_participante_pregunta" ON "respuesta"("id_participante", "id_pregunta");

-- CreateIndex
CREATE UNIQUE INDEX "uq_respuesta_opcion" ON "respuesta_seleccionada"("id_respuesta", "id_opcion");

-- CreateIndex
CREATE UNIQUE INDEX "suscripcion_organizacion_id_organizacion_key" ON "suscripcion_organizacion"("id_organizacion");

-- CreateIndex
CREATE UNIQUE INDEX "transaccion_pago_id_transaccion_externa_key" ON "transaccion_pago"("id_transaccion_externa");

-- AddForeignKey
ALTER TABLE "invitacion_organizacion" ADD CONSTRAINT "invitacion_organizacion_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitacion_organizacion" ADD CONSTRAINT "invitacion_organizacion_id_invitador_fkey" FOREIGN KEY ("id_invitador") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membresia" ADD CONSTRAINT "membresia_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membresia" ADD CONSTRAINT "membresia_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudiante" ADD CONSTRAINT "estudiante_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluacion" ADD CONSTRAINT "evaluacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluacion" ADD CONSTRAINT "evaluacion_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pregunta" ADD CONSTRAINT "pregunta_id_evaluacion_fkey" FOREIGN KEY ("id_evaluacion") REFERENCES "evaluacion"("id_evaluacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opcion_respuesta" ADD CONSTRAINT "opcion_respuesta_id_pregunta_fkey" FOREIGN KEY ("id_pregunta") REFERENCES "pregunta"("id_pregunta") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espacio_completar" ADD CONSTRAINT "espacio_completar_id_pregunta_fkey" FOREIGN KEY ("id_pregunta") REFERENCES "pregunta"("id_pregunta") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuesta_valida" ADD CONSTRAINT "respuesta_valida_id_espacio_fkey" FOREIGN KEY ("id_espacio") REFERENCES "espacio_completar"("id_espacio") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesion" ADD CONSTRAINT "sesion_id_evaluacion_fkey" FOREIGN KEY ("id_evaluacion") REFERENCES "evaluacion"("id_evaluacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participante" ADD CONSTRAINT "participante_id_sesion_fkey" FOREIGN KEY ("id_sesion") REFERENCES "sesion"("id_sesion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participante" ADD CONSTRAINT "participante_id_estudiante_fkey" FOREIGN KEY ("id_estudiante") REFERENCES "estudiante"("id_estudiante") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuesta" ADD CONSTRAINT "respuesta_id_participante_fkey" FOREIGN KEY ("id_participante") REFERENCES "participante"("id_participante") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuesta" ADD CONSTRAINT "respuesta_id_pregunta_fkey" FOREIGN KEY ("id_pregunta") REFERENCES "pregunta"("id_pregunta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuesta" ADD CONSTRAINT "respuesta_id_usuario_corrector_fkey" FOREIGN KEY ("id_usuario_corrector") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuesta_seleccionada" ADD CONSTRAINT "respuesta_seleccionada_id_respuesta_fkey" FOREIGN KEY ("id_respuesta") REFERENCES "respuesta"("id_respuesta") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuesta_seleccionada" ADD CONSTRAINT "respuesta_seleccionada_id_opcion_fkey" FOREIGN KEY ("id_opcion") REFERENCES "opcion_respuesta"("id_opcion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_monitoreo" ADD CONSTRAINT "evento_monitoreo_id_participante_fkey" FOREIGN KEY ("id_participante") REFERENCES "participante"("id_participante") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria_calificacion" ADD CONSTRAINT "auditoria_calificacion_id_respuesta_fkey" FOREIGN KEY ("id_respuesta") REFERENCES "respuesta"("id_respuesta") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria_calificacion" ADD CONSTRAINT "auditoria_calificacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uso_ia_log" ADD CONSTRAINT "uso_ia_log_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uso_ia_log" ADD CONSTRAINT "uso_ia_log_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria_administrativa" ADD CONSTRAINT "auditoria_administrativa_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suscripcion_organizacion" ADD CONSTRAINT "suscripcion_organizacion_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaccion_pago" ADD CONSTRAINT "transaccion_pago_id_suscripcion_fkey" FOREIGN KEY ("id_suscripcion") REFERENCES "suscripcion_organizacion"("id_suscripcion") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaccion_pago" ADD CONSTRAINT "transaccion_pago_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion") ON DELETE CASCADE ON UPDATE CASCADE;

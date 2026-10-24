-- CreateEnum
CREATE TYPE "EstadoEventoWebhook" AS ENUM ('RECIBIDO', 'PROCESADO', 'ERROR', 'IGNORADO');

-- AlterEnum
ALTER TYPE "EstadoPagoTransaccion" ADD VALUE 'EN_REVISION';

-- CreateTable
CREATE TABLE "evento_webhook" (
    "id_evento_webhook" SERIAL NOT NULL,
    "proveedor" "ProveedorPago" NOT NULL,
    "id_evento_externo" VARCHAR(150) NOT NULL,
    "tipo" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "estado" "EstadoEventoWebhook" NOT NULL DEFAULT 'RECIBIDO',
    "error" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "procesado_en" TIMESTAMP(3),

    CONSTRAINT "evento_webhook_pkey" PRIMARY KEY ("id_evento_webhook")
);

-- CreateIndex
CREATE INDEX "idx_evento_webhook_estado" ON "evento_webhook"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "uq_evento_webhook_proveedor_externo" ON "evento_webhook"("proveedor", "id_evento_externo");

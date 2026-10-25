-- AlterEnum
ALTER TYPE "ProveedorPago" ADD VALUE 'LIBELULA';

-- AlterTable
ALTER TABLE "transaccion_pago" ADD COLUMN "identificador_libelula" VARCHAR(100),
ADD COLUMN "invoice_id" VARCHAR(100),
ADD COLUMN "invoice_url" TEXT,
ADD COLUMN "numero_factura" VARCHAR(100),
ADD COLUMN "qr_simple_url" TEXT,
ADD COLUMN "token_callback_hash" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "transaccion_pago_identificador_libelula_key" ON "transaccion_pago"("identificador_libelula");

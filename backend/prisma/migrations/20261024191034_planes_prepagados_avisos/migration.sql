-- AlterTable
ALTER TABLE "transaccion_pago" ADD COLUMN     "periodo_meses" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "aviso_vencimiento" (
    "id_aviso_vencimiento" SERIAL NOT NULL,
    "id_organizacion" INTEGER NOT NULL,
    "fecha_fin_periodo" TIMESTAMP(3) NOT NULL,
    "dias_antes" INTEGER NOT NULL,
    "enviado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aviso_vencimiento_pkey" PRIMARY KEY ("id_aviso_vencimiento")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_aviso_vencimiento" ON "aviso_vencimiento"("id_organizacion", "fecha_fin_periodo", "dias_antes");

-- AddForeignKey
ALTER TABLE "aviso_vencimiento" ADD CONSTRAINT "aviso_vencimiento_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion") ON DELETE CASCADE ON UPDATE CASCADE;

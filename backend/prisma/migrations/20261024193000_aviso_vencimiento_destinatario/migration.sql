-- DropIndex
DROP INDEX "uq_aviso_vencimiento";

-- AlterTable
ALTER TABLE "aviso_vencimiento" ADD COLUMN "correo_destinatario" VARCHAR(150) NOT NULL DEFAULT '';

-- El valor temporal permite migrar avisos históricos sin su destinatario.
ALTER TABLE "aviso_vencimiento" ALTER COLUMN "correo_destinatario" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "uq_aviso_vencimiento_destinatario" ON "aviso_vencimiento"("id_organizacion", "fecha_fin_periodo", "dias_antes", "correo_destinatario");

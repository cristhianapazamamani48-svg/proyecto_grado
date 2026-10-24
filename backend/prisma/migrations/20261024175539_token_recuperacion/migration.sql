-- CreateTable
CREATE TABLE "token_recuperacion" (
    "id_token_recuperacion" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "usado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_recuperacion_pkey" PRIMARY KEY ("id_token_recuperacion")
);

-- CreateIndex
CREATE UNIQUE INDEX "token_recuperacion_token_hash_key" ON "token_recuperacion"("token_hash");

-- CreateIndex
CREATE INDEX "idx_token_recuperacion_usuario" ON "token_recuperacion"("id_usuario");

-- AddForeignKey
ALTER TABLE "token_recuperacion" ADD CONSTRAINT "token_recuperacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

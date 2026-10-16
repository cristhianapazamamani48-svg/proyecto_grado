import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';

/**
 * Valores genéricos que alguna vez quedaron como placeholder en el código.
 * Se rechazan activamente para impedir que el sistema arranque con ellos.
 */
const SECRETOS_JWT_GENERICOS = ['super-secreto-uub-evaluaciones-jwt-key-2026'];

const PASSWORD_SUPERADMIN_GENERICA = 'SuperAdminSecret2026!';

const mensajeDeGeneracion =
  'Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))" ' +
  'y agrégalo a backend/.env';

/**
 * Obtiene JWT_SECRET y **falla al arrancar** si falta, es un valor genérico
 * heredado o es demasiado corto. Nunca devuelve un secreto por defecto.
 */
export function obtenerJwtSecret(configService: ConfigService): string {
  const secret = configService.get<string>('JWT_SECRET')?.trim();

  if (!secret) {
    throw new Error(`JWT_SECRET no está definido. ${mensajeDeGeneracion}`);
  }

  if (SECRETOS_JWT_GENERICOS.includes(secret)) {
    throw new Error(
      `JWT_SECRET contiene un valor genérico de desarrollo y no puede usarse en runtime. ${mensajeDeGeneracion}`,
    );
  }

  if (secret.length < 32) {
    throw new Error(`JWT_SECRET debe tener al menos 32 caracteres. ${mensajeDeGeneracion}`);
  }

  return secret;
}

/**
 * Resuelve la contraseña del superusuario inicial.
 * - Si está definida y no es el valor genérico público, la usa.
 * - Si falta en producción: lanza error (fail-fast).
 * - Si falta en desarrollo: genera una contraseña aleatoria y la muestra una
 *   sola vez en el log de arranque (no existe cuenta creada con clave conocida).
 */
export function obtenerPasswordSuperAdmin(logger: {
  warn: (mensaje: string) => void;
}): string {
  const definida = process.env.SUPERADMIN_PASSWORD?.trim();

  if (definida === PASSWORD_SUPERADMIN_GENERICA) {
    throw new Error(
      'SUPERADMIN_PASSWORD contiene el valor por defecto público "SuperAdminSecret2026!". ' +
        'Reemplázalo por una contraseña propia en backend/.env antes de arrancar.',
    );
  }

  if (definida) return definida;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SUPERADMIN_PASSWORD es obligatoria en producción para crear el superusuario inicial. ' +
        'Defínela en backend/.env (o en las variables del servicio backend).',
    );
  }

  const generada = randomBytes(18).toString('base64url');
  logger.warn(
    `SUPERADMIN_PASSWORD no está definida: se generó una contraseña temporal ` +
      `para el superusuario inicial. GUÁRDALA AHORA, no se volverá a mostrar: ${generada}`,
  );
  return generada;
}

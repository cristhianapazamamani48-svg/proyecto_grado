import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Variante del ThrottlerGuard que solo aplica a peticiones HTTP.
 * El guard global también alcanza a los gateways WebSocket, donde no existe
 * `req.ip`; sin este filtro el handshake/eventos podrían fallar o contar mal.
 */
@Injectable()
export class ThrottlerHttpGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    return super.shouldSkip(context);
  }
}

import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class EvaluacionGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('unirseASesion')
  handleUnirseASesion(@MessageBody() data: { codigoSesion: string }, @ConnectedSocket() client: Socket) {
    client.join(`sesion_${data.codigoSesion}`);
    return { status: 'unido', sala: `sesion_${data.codigoSesion}` };
  }

  /**
   * Método de soporte para el modo en vivo (Fase 2)
   */
  notificarAvanzarPregunta(codigoSesion: string, preguntaIndex: number) {
    this.server.to(`sesion_${codigoSesion}`).emit('preguntaAvanzada', { preguntaIndex, timestamp: Date.now() });
  }

  notificarSesionFinalizada(codigoSesion: string) {
    this.server.to(`sesion_${codigoSesion}`).emit('sesionFinalizada', { timestamp: Date.now() });
  }
}

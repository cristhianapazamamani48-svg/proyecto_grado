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
    if (data?.codigoSesion) {
      client.join(`sesion_${data.codigoSesion}`);
      return { status: 'unido', sala: `sesion_${data.codigoSesion}` };
    }
  }

  notificarAvanzarPregunta(codigoSesion: string, preguntaIndex: number) {
    if (this.server) {
      this.server.to(`sesion_${codigoSesion}`).emit('preguntaAvanzada', { preguntaIndex, timestamp: Date.now() });
    }
  }

  notificarSesionFinalizada(codigoSesion: string) {
    if (this.server) {
      this.server.to(`sesion_${codigoSesion}`).emit('sesionFinalizada', { timestamp: Date.now() });
    }
  }

  notificarEventoMonitoreo(codigoSesion: string, evento: {
    idEvento: number;
    idParticipante: number;
    nombreParticipante: string;
    tipo: string;
    detalle?: string | null;
    fechaEvento: Date;
  }) {
    if (this.server) {
      this.server.to(`sesion_${codigoSesion}`).emit('eventoMonitoreo', evento);
    }
  }

  notificarParticipanteActualizado(codigoSesion: string, data: {
    idParticipante: number;
    nombre: string;
    estado: string;
    puntajeTotal?: number | null;
    porcentaje?: number | null;
  }) {
    if (this.server) {
      this.server.to(`sesion_${codigoSesion}`).emit('participanteActualizado', data);
    }
  }
}

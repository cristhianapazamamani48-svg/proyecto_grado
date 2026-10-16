import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

interface UsuarioAutenticado {
  sub: number;
  tipo?: string;
  rol?: string;
}

/**
 * Gateway de tiempo real. Todas las salas (`sesion_{codigo}`) quedan
 * restringidas al docente dueño de la evaluación (o a un SUPER_ADMIN); antes
 * bastaba conocer el código de sesión para escuchar nombres, puntajes e
 * infracciones de los participantes.
 */
@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3002').split(','),
  },
})
export class EvaluacionGateway {
  private readonly logger = new Logger(EvaluacionGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  @SubscribeMessage('unirseASesion')
  async handleUnirseASesion(
    @MessageBody() data: { codigoSesion: string },
    @ConnectedSocket() client: Socket,
  ) {
    const codigo = String(data?.codigoSesion || '').trim().toUpperCase();

    const usuario = this.autenticar(client);
    if (!usuario) {
      return this.rechazar(client, 'Se requiere un token de usuario válido.');
    }

    if (!codigo) {
      return this.rechazar(client, 'Código de sesión requerido.');
    }

    const sesion = await this.prisma.sesion.findUnique({
      where: { codigo },
      select: { idSesion: true, codigo: true, evaluacion: { select: { idUsuario: true } } },
    });

    if (!sesion) {
      return this.rechazar(client, 'Sesión no encontrada.');
    }

    if (usuario.rol !== 'SUPER_ADMIN' && sesion.evaluacion.idUsuario !== usuario.sub) {
      return this.rechazar(client, 'No tienes acceso a esta sesión.');
    }

    void client.join(`sesion_${sesion.codigo}`);
    return { status: 'unido', sala: `sesion_${sesion.codigo}` };
  }

  private autenticar(client: Socket): UsuarioAutenticado | null {
    const token =
      (client.handshake.auth?.token as string | undefined) ||
      this.extraerBearer(client.handshake.headers?.authorization);

    if (!token) return null;

    try {
      const payload = this.jwtService.verify<{ sub: number; tipo?: string; rol?: string }>(token);
      if (!payload?.sub || payload.tipo !== 'USUARIO') return null;
      return { sub: Number(payload.sub), tipo: payload.tipo, rol: payload.rol };
    } catch {
      return null;
    }
  }

  private extraerBearer(cabecera?: string): string | null {
    if (!cabecera) return null;
    const [tipo, valor] = cabecera.split(' ');
    return tipo?.toLowerCase() === 'bearer' && valor ? valor : null;
  }

  private rechazar(client: Socket, mensaje: string) {
    this.logger.warn(`Conexión ${client.id} rechazada al unirse a una sala: ${mensaje}`);
    return { status: 'error', mensaje };
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

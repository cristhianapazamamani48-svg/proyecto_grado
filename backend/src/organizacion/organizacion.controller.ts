import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
  NotFoundException,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrganizacionService } from './organizacion.service';
import { PrismaService } from '../prisma/prisma.service';
import { RolUsuario } from '@prisma/client';

@Controller('organizaciones')
@UseGuards(AuthGuard('jwt'))
export class OrganizacionController {
  constructor(
    private readonly organizacionService: OrganizacionService,
    private readonly prisma: PrismaService,
  ) {}

  private async obtenerIdOrganizacionUsuario(idUsuario: number): Promise<number> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { idUsuario },
      select: { idOrganizacionActual: true },
    });
    if (!usuario || !usuario.idOrganizacionActual) {
      throw new NotFoundException('El usuario no pertenece a ninguna organización activa.');
    }
    return usuario.idOrganizacionActual;
  }

  private async verificarEsAdmin(idUsuario: number, idOrganizacion: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { idUsuario },
      select: { rol: true },
    });
    if (usuario?.rol === RolUsuario.SUPER_ADMIN) return;

    const membresia = await this.prisma.membresia.findUnique({
      where: {
        idUsuario_idOrganizacion: {
          idUsuario,
          idOrganizacion,
        },
      },
    });

    if (
      !membresia ||
      (membresia.rol !== RolUsuario.ADMIN_ORGANIZACION && membresia.rol !== RolUsuario.SUPER_ADMIN)
    ) {
      throw new ForbiddenException('Se requieren permisos de administrador de organización.');
    }
  }

  @Get('mi-organizacion')
  async obtenerMiOrganizacion(@Request() req: any) {
    const idOrg = await this.obtenerIdOrganizacionUsuario(Number(req.user.sub));
    return this.organizacionService.obtenerOrganizacion(idOrg);
  }

  @Get('mi-organizacion/miembros')
  async listarMiembros(@Request() req: any) {
    const idOrg = await this.obtenerIdOrganizacionUsuario(Number(req.user.sub));
    return this.organizacionService.listarMiembros(idOrg);
  }

  @Patch('mi-organizacion/miembros/:id/aprobar')
  async aprobarMembresia(@Param('id', ParseIntPipe) idMembresia: number, @Request() req: any) {
    const idOrg = await this.obtenerIdOrganizacionUsuario(Number(req.user.sub));
    await this.verificarEsAdmin(Number(req.user.sub), idOrg);
    return this.organizacionService.aprobarMembresia(idOrg, idMembresia);
  }

  @Patch('mi-organizacion/miembros/:id/rechazar')
  async rechazarMembresia(@Param('id', ParseIntPipe) idMembresia: number, @Request() req: any) {
    const idOrg = await this.obtenerIdOrganizacionUsuario(Number(req.user.sub));
    await this.verificarEsAdmin(Number(req.user.sub), idOrg);
    return this.organizacionService.rechazarMembresia(idOrg, idMembresia);
  }

  @Post('mi-organizacion/invitar')
  async invitarUsuario(
    @Request() req: any,
    @Body() body: { correo: string; rol?: RolUsuario },
  ) {
    const idOrg = await this.obtenerIdOrganizacionUsuario(Number(req.user.sub));
    await this.verificarEsAdmin(Number(req.user.sub), idOrg);
    return this.organizacionService.crearInvitacion(
      idOrg,
      Number(req.user.sub),
      body.correo,
      body.rol,
    );
  }

  @Get('mi-organizacion/invitaciones')
  async listarInvitaciones(@Request() req: any) {
    const idOrg = await this.obtenerIdOrganizacionUsuario(Number(req.user.sub));
    await this.verificarEsAdmin(Number(req.user.sub), idOrg);
    return this.organizacionService.listarInvitaciones(idOrg);
  }

  @Delete('mi-organizacion/invitaciones/:id')
  async revocarInvitacion(@Param('id', ParseIntPipe) idInvitacion: number, @Request() req: any) {
    const idOrg = await this.obtenerIdOrganizacionUsuario(Number(req.user.sub));
    await this.verificarEsAdmin(Number(req.user.sub), idOrg);
    return this.organizacionService.revocarInvitacion(idOrg, idInvitacion);
  }

  @Post('aceptar-invitacion/:token')
  async aceptarInvitacion(@Param('token') token: string, @Request() req: any) {
    return this.organizacionService.aceptarInvitacion(token, Number(req.user.sub));
  }

  @Post('mi-organizacion/codigo-acceso')
  async generarCodigoAcceso(@Request() req: any) {
    const idOrg = await this.obtenerIdOrganizacionUsuario(Number(req.user.sub));
    await this.verificarEsAdmin(Number(req.user.sub), idOrg);
    return this.organizacionService.generarCodigoAcceso(idOrg);
  }

  @Patch('mi-organizacion/codigo-acceso')
  async configurarCodigoAcceso(
    @Request() req: any,
    @Body()
    body: {
      activo?: boolean;
      rol?: RolUsuario;
      aprobacionRequerida?: boolean;
    },
  ) {
    const idOrg = await this.obtenerIdOrganizacionUsuario(Number(req.user.sub));
    await this.verificarEsAdmin(Number(req.user.sub), idOrg);
    return this.organizacionService.configurarCodigoAcceso(idOrg, body);
  }

  @Post('unirse-codigo')
  async unirseConCodigo(@Request() req: any, @Body() body: { codigo: string }) {
    return this.organizacionService.unirseConCodigo(body.codigo, Number(req.user.sub));
  }

  @Get('mi-organizacion/uso-ia')
  async obtenerUsoIa(@Request() req: any) {
    const idOrg = await this.obtenerIdOrganizacionUsuario(Number(req.user.sub));
    return this.organizacionService.obtenerUsosIa(idOrg);
  }
}

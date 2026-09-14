import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SuperadminGuard } from './guards/superadmin.guard';
import { SuperadminService } from './superadmin.service';
import { RolUsuario, EstadoGeneral, TipoPlan } from '@prisma/client';

@Controller('superadmin')
@UseGuards(AuthGuard('jwt'), SuperadminGuard)
export class SuperadminController {
  constructor(private readonly superadminService: SuperadminService) {}

  @Get('resumen')
  async obtenerResumen() {
    return this.superadminService.obtenerResumenDashboard();
  }

  @Get('instituciones')
  async listarInstituciones(
    @Query('q') q?: string,
    @Query('estado') estado?: EstadoGeneral,
    @Query('plan') plan?: TipoPlan,
  ) {
    return this.superadminService.listarInstituciones({ q, estado, plan });
  }

  @Post('instituciones')
  async crearInstitucion(
    @Request() req: any,
    @Body()
    body: {
      nombre: string;
      slug: string;
      plan?: TipoPlan;
      limiteDocentes?: number;
      limiteEstudiantes?: number;
      limiteEvaluaciones?: number;
      limiteCorreccionesIaMes?: number;
      iaHabilitada?: boolean;
      codigoAccesoActivo?: boolean;
      aprobacionRequerida?: boolean;
    },
  ) {
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.superadminService.crearInstitucion(
      Number(req.user.sub),
      body,
      ip,
      ua,
    );
  }

  @Get('instituciones/:id')
  async obtenerDetalleInstitucion(@Param('id', ParseIntPipe) id: number) {
    return this.superadminService.obtenerDetalleInstitucion(id);
  }

  @Patch('instituciones/:id')
  async actualizarInstitucion(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body()
    body: {
      nombre?: string;
      slug?: string;
      limiteDocentes?: number;
      limiteEstudiantes?: number;
      limiteEvaluaciones?: number;
      limiteCorreccionesIaMes?: number;
      iaHabilitada?: boolean;
      codigoAccesoActivo?: boolean;
      aprobacionRequerida?: boolean;
    },
  ) {
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.superadminService.actualizarInstitucion(
      Number(req.user.sub),
      id,
      body,
      ip,
      ua,
    );
  }

  @Patch('instituciones/:id/estado')
  async cambiarEstadoInstitucion(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body() body: { estado: EstadoGeneral },
  ) {
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.superadminService.cambiarEstadoInstitucion(
      Number(req.user.sub),
      id,
      body.estado,
      ip,
      ua,
    );
  }

  @Patch('instituciones/:id/plan')
  async cambiarPlanInstitucion(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body() body: { plan: TipoPlan; ajustarLimitesDefault?: boolean },
  ) {
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.superadminService.cambiarPlanInstitucion(
      Number(req.user.sub),
      id,
      body.plan,
      body.ajustarLimitesDefault ?? true,
      ip,
      ua,
    );
  }

  @Get('usuarios')
  async listarUsuariosGlobal(
    @Query('q') q?: string,
    @Query('idOrganizacion') idOrganizacion?: string,
    @Query('rol') rol?: RolUsuario,
    @Query('estado') estado?: EstadoGeneral,
  ) {
    return this.superadminService.listarUsuariosGlobal({
      q,
      idOrganizacion: idOrganizacion ? Number(idOrganizacion) : undefined,
      rol,
      estado,
    });
  }

  @Patch('usuarios/:id/estado')
  async cambiarEstadoUsuario(
    @Param('id', ParseIntPipe) idUsuario: number,
    @Request() req: any,
    @Body() body: { estado: EstadoGeneral },
  ) {
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.superadminService.cambiarEstadoUsuario(
      Number(req.user.sub),
      idUsuario,
      body.estado,
      ip,
      ua,
    );
  }

  @Patch('usuarios/:id/rol')
  async cambiarRolUsuario(
    @Param('id', ParseIntPipe) idUsuario: number,
    @Request() req: any,
    @Body() body: { rol: RolUsuario },
  ) {
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.superadminService.cambiarRolUsuario(
      Number(req.user.sub),
      idUsuario,
      body.rol,
      ip,
      ua,
    );
  }

  @Post('usuarios/:id/asignar-institucion')
  async asignarUsuarioInstitucion(
    @Param('id', ParseIntPipe) idUsuario: number,
    @Request() req: any,
    @Body() body: { idOrganizacion: number; rol?: RolUsuario },
  ) {
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.superadminService.asignarUsuarioInstitucion(
      Number(req.user.sub),
      idUsuario,
      body.idOrganizacion,
      body.rol || RolUsuario.DOCENTE,
      ip,
      ua,
    );
  }

  @Delete('usuarios/:id/membresia/:idOrg')
  async retirarUsuarioInstitucion(
    @Param('id', ParseIntPipe) idUsuario: number,
    @Param('idOrg', ParseIntPipe) idOrganizacion: number,
    @Request() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.superadminService.retirarUsuarioInstitucion(
      Number(req.user.sub),
      idUsuario,
      idOrganizacion,
      ip,
      ua,
    );
  }

  @Get('ia/consumo')
  async obtenerConsumoIaGlobal() {
    return this.superadminService.obtenerConsumoIaGlobal();
  }

  @Get('auditoria')
  async obtenerAuditoria(
    @Query('q') q?: string,
    @Query('idUsuario') idUsuario?: string,
  ) {
    return this.superadminService.obtenerAuditoria({
      q,
      idUsuario: idUsuario ? Number(idUsuario) : undefined,
    });
  }
}

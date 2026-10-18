import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  UseGuards,
  Request,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PagosService } from './pagos.service';
import { PrismaService } from '../prisma/prisma.service';
import { TipoPlan, ProveedorPago, RolUsuario } from '@prisma/client';

@Controller('pagos')
export class PagosController {
  constructor(
    private readonly pagosService: PagosService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Solo cuentas de usuario (docente/superadmin) pueden operar pagos.
   * Impide que tokens de participante guest o de estudiante, cuyos IDs
   * autoincrementales colisionan con idUsuario, accedan a otra organización.
   */
  private requiereUsuario(req: any): number {
    if (req.user?.tipo !== 'USUARIO') {
      throw new ForbiddenException('Esta acción requiere una cuenta de usuario.');
    }
    return Number(req.user.sub);
  }

  private async verificarEsAdmin(idUsuario: number, idOrganizacion: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { idUsuario },
      select: { rol: true },
    });
    if (usuario?.rol === RolUsuario.SUPER_ADMIN) return;

    const membresia = await this.prisma.membresia.findUnique({
      where: { idUsuario_idOrganizacion: { idUsuario, idOrganizacion } },
    });

    if (
      !membresia ||
      (membresia.rol !== RolUsuario.ADMIN_ORGANIZACION && membresia.rol !== RolUsuario.SUPER_ADMIN)
    ) {
      throw new ForbiddenException('Se requieren permisos de administrador de organización.');
    }
  }

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

  @Post('checkout')
  @UseGuards(AuthGuard('jwt'))
  async crearCheckout(
    @Request() req: any,
    @Body() body: { plan?: TipoPlan; proveedor?: ProveedorPago },
  ) {
    const idUsuario = this.requiereUsuario(req);
    const idOrganizacion = await this.obtenerIdOrganizacionUsuario(idUsuario);
    await this.verificarEsAdmin(idUsuario, idOrganizacion);
    const plan = body.plan || TipoPlan.MAESTRO_PRO;

    return this.pagosService.crearCheckout(
      idUsuario,
      idOrganizacion,
      plan,
      body.proveedor || ProveedorPago.MOCK_SANDBOX,
    );
  }

  @Post('sandbox/:idTransaccion/aprobar')
  @UseGuards(AuthGuard('jwt'))
  async aprobarPagoSandbox(@Request() req: any, @Param('idTransaccion') idTransaccion: string) {
    const idUsuario = this.requiereUsuario(req);
    const idOrganizacion = await this.obtenerIdOrganizacionUsuario(idUsuario);
    await this.verificarEsAdmin(idUsuario, idOrganizacion);
    return this.pagosService.aprobarPagoSandbox(idOrganizacion, Number(idTransaccion));
  }

  @Post('paypal/:idTransaccionExterna/capturar')
  @UseGuards(AuthGuard('jwt'))
  async capturarPagoPayPal(@Request() req: any, @Param('idTransaccionExterna') idTransaccionExterna: string) {
    const idUsuario = this.requiereUsuario(req);
    const idOrganizacion = await this.obtenerIdOrganizacionUsuario(idUsuario);
    await this.verificarEsAdmin(idUsuario, idOrganizacion);
    return this.pagosService.capturarPagoPayPal(idOrganizacion, idTransaccionExterna);
  }

  @Post('webhook/:proveedor')
  async procesarWebhook(
    @Param('proveedor') proveedorStr: string,
    @Body() body: any,
    @Headers() headers: any,
    @Request() req: any,
  ) {
    const provUpper = proveedorStr.toUpperCase();
    let proveedor: ProveedorPago;
    if (provUpper === 'MERCADOPAGO') proveedor = ProveedorPago.MERCADOPAGO;
    else if (provUpper === 'PAYPAL') proveedor = ProveedorPago.PAYPAL;
    else if (provUpper === 'LIVEES') proveedor = ProveedorPago.LIVEES;
    else proveedor = ProveedorPago.MOCK_SANDBOX;

    return this.pagosService.procesarWebhook(proveedor, body, headers, req?.rawBody);
  }

  @Get('mi-suscripcion')
  @UseGuards(AuthGuard('jwt'))
  async obtenerMiSuscripcion(@Request() req: any) {
    const idUsuario = this.requiereUsuario(req);
    const idOrganizacion = await this.obtenerIdOrganizacionUsuario(idUsuario);

    return this.pagosService.obtenerSuscripcionOrg(idOrganizacion);
  }

  @Post('cancelar')
  @UseGuards(AuthGuard('jwt'))
  async cancelarSuscripcion(@Request() req: any) {
    const idUsuario = this.requiereUsuario(req);
    const idOrganizacion = await this.obtenerIdOrganizacionUsuario(idUsuario);
    await this.verificarEsAdmin(idUsuario, idOrganizacion);

    return this.pagosService.cancelarSuscripcion(idUsuario, idOrganizacion);
  }
}

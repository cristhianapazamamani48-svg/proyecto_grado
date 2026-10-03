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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PagosService } from './pagos.service';
import { PrismaService } from '../prisma/prisma.service';
import { TipoPlan, ProveedorPago } from '@prisma/client';

@Controller('pagos')
export class PagosController {
  constructor(
    private readonly pagosService: PagosService,
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

  @Post('checkout')
  @UseGuards(AuthGuard('jwt'))
  async crearCheckout(
    @Request() req: any,
    @Body() body: { plan?: TipoPlan; proveedor?: ProveedorPago },
  ) {
    const idUsuario = Number(req.user.sub);
    const idOrganizacion = await this.obtenerIdOrganizacionUsuario(idUsuario);
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
    const idUsuario = Number(req.user.sub);
    const idOrganizacion = await this.obtenerIdOrganizacionUsuario(idUsuario);
    return this.pagosService.aprobarPagoSandbox(idOrganizacion, Number(idTransaccion));
  }

  @Post('webhook/:proveedor')
  async procesarWebhook(
    @Param('proveedor') proveedorStr: string,
    @Body() body: any,
    @Headers() headers: any,
  ) {
    const provUpper = proveedorStr.toUpperCase();
    let proveedor: ProveedorPago;
    if (provUpper === 'MERCADOPAGO') proveedor = ProveedorPago.MERCADOPAGO;
    else if (provUpper === 'PAYPAL') proveedor = ProveedorPago.PAYPAL;
    else proveedor = ProveedorPago.MOCK_SANDBOX;

    return this.pagosService.procesarWebhook(proveedor, body, headers);
  }

  @Get('mi-suscripcion')
  @UseGuards(AuthGuard('jwt'))
  async obtenerMiSuscripcion(@Request() req: any) {
    const idUsuario = Number(req.user.sub);
    const idOrganizacion = await this.obtenerIdOrganizacionUsuario(idUsuario);

    return this.pagosService.obtenerSuscripcionOrg(idOrganizacion);
  }

  @Post('cancelar')
  @UseGuards(AuthGuard('jwt'))
  async cancelarSuscripcion(@Request() req: any) {
    const idUsuario = Number(req.user.sub);
    const idOrganizacion = await this.obtenerIdOrganizacionUsuario(idUsuario);

    return this.pagosService.cancelarSuscripcion(idUsuario, idOrganizacion);
  }
}

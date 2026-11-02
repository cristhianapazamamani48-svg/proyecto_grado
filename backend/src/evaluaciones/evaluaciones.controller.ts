import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
  Patch,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import pdfParse from 'pdf-parse';
import type { Request as ExpressRequest } from 'express';
import { AiService } from '../ai/ai.service';
import { EvaluacionesService } from './evaluaciones.service';
import type { CrearEvaluacionDto } from './evaluaciones.service';
import { AuthGuard } from '@nestjs/passport';
import { EstadoEvaluacion } from '@prisma/client';
import {
  GenerarEvaluacionDto,
  GenerarEvaluacionPorTemaDto,
} from './dto/generar-evaluacion.dto';
import { ConfiguracionEvaluacionDto } from './dto/configuracion-evaluacion.dto';

type AuthenticatedRequest = ExpressRequest & {
  user: { sub: string | number; tipo?: string };
};

@Controller('evaluaciones')
@UseGuards(AuthGuard('jwt'))
export class EvaluacionesController {
  constructor(
    private readonly evaluacionesService: EvaluacionesService,
    private readonly aiService: AiService,
  ) {}

  private requiereDocente(user: AuthenticatedRequest['user']) {
    if (user.tipo !== 'USUARIO')
      throw new ForbiddenException('Esta acción requiere una cuenta docente.');
  }

  @Get()
  async listar(@Request() req: AuthenticatedRequest) {
    this.requiereDocente(req.user);
    return this.evaluacionesService.listarPorDocente(Number(req.user.sub));
  }

  @Get('reportes/general')
  async obtenerReporteGeneral(@Request() req: AuthenticatedRequest) {
    this.requiereDocente(req.user);
    return this.evaluacionesService.obtenerReporteGeneral(Number(req.user.sub));
  }

  @Get('generacion/estado')
  obtenerEstadoGeneracion(@Request() req: AuthenticatedRequest) {
    this.requiereDocente(req.user);
    return this.aiService.getEvaluationGenerationStatus();
  }

  @Post('generacion/tema')
  generarPorTema(
    @Request() req: AuthenticatedRequest,
    @Body() dto: GenerarEvaluacionPorTemaDto,
  ) {
    this.requiereDocente(req.user);
    return this.aiService.generarEvaluacion(Number(req.user.sub), {
      contenido: dto.tema,
      tema: dto.tema,
      tiposPregunta: dto.tiposPregunta,
      cantidadPreguntas: dto.cantidadPreguntas,
      idiomaConfirmado: dto.idiomaConfirmado,
    });
  }

  @Post('generacion/pdf')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
      fileFilter: (_request, file, callback) => {
        const hasPdfExtension = file.originalname
          .toLowerCase()
          .endsWith('.pdf');
        if (file.mimetype !== 'application/pdf' && !hasPdfExtension) {
          callback(
            new BadRequestException('Solo se permiten archivos PDF.'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async generarDesdePdf(
    @Request() req: AuthenticatedRequest,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Body() dto: GenerarEvaluacionDto,
  ) {
    this.requiereDocente(req.user);
    if (!archivo) throw new BadRequestException('Selecciona un archivo PDF.');
    if (archivo.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new BadRequestException(
        'El archivo seleccionado no es un PDF válido.',
      );
    }

    let contenido: string;
    try {
      const documento = await pdfParse(archivo.buffer);
      contenido = documento.text.replace(/\s+/g, ' ').trim();
    } catch {
      throw new BadRequestException(
        'No se pudo leer el PDF. Verifica que no esté dañado o protegido con contraseña.',
      );
    }

    if (contenido.length < 50) {
      throw new BadRequestException(
        'El PDF no contiene suficiente texto seleccionable. Los documentos escaneados requieren OCR y no se pueden procesar todavía.',
      );
    }
    if (contenido.length > 100_000) {
      throw new BadRequestException(
        'El texto del PDF supera el límite de 100 000 caracteres.',
      );
    }

    return this.aiService.generarEvaluacion(Number(req.user.sub), {
      contenido,
      tiposPregunta: dto.tiposPregunta,
      cantidadPreguntas: dto.cantidadPreguntas,
      idiomaConfirmado: dto.idiomaConfirmado,
    });
  }

  @Get(':id')
  async obtenerPorId(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    this.requiereDocente(req.user);
    return this.evaluacionesService.obtenerPorId(
      Number(id),
      Number(req.user.sub),
    );
  }

  @Post()
  async crear(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CrearEvaluacionDto,
  ) {
    this.requiereDocente(req.user);
    return this.evaluacionesService.crearEvaluacion(Number(req.user.sub), dto);
  }

  @Put(':id')
  async actualizar(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: CrearEvaluacionDto,
  ) {
    this.requiereDocente(req.user);
    return this.evaluacionesService.actualizarEvaluacion(
      Number(id),
      Number(req.user.sub),
      dto,
    );
  }

  @Post(':id/duplicar')
  async duplicar(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    this.requiereDocente(req.user);
    return this.evaluacionesService.duplicarEvaluacion(
      Number(id),
      Number(req.user.sub),
    );
  }

  @Patch(':id/estado')
  async cambiarEstado(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body('estado') estado: EstadoEvaluacion,
  ) {
    this.requiereDocente(req.user);
    return this.evaluacionesService.cambiarEstado(
      Number(id),
      Number(req.user.sub),
      estado,
    );
  }

  @Patch(':id/configuracion')
  async actualizarConfiguracion(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: ConfiguracionEvaluacionDto,
  ) {
    this.requiereDocente(req.user);
    return this.evaluacionesService.actualizarConfiguracion(
      Number(id),
      Number(req.user.sub),
      dto,
    );
  }

  @Delete(':id')
  async eliminar(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    this.requiereDocente(req.user);
    return this.evaluacionesService.eliminarEvaluacion(
      Number(id),
      Number(req.user.sub),
    );
  }
}

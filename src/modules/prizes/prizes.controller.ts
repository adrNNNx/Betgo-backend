import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PrizesService } from './prizes.service';
import { CreatePrizeDto, UpdatePrizeDto, PrizeQueryDto } from './dto';
import { ImageFilePipe } from '../banners/pipes/image-file.pipe';
import { Public, Roles } from '../auth/decorators';
import { UserRole } from '../users/entities/user.entity';

@Controller('prizes')
export class PrizesController {
  constructor(private readonly prizesService: PrizesService) {}

  /**
   * Crear premio.
   * POST /prizes  (multipart/form-data, campo 'file' opcional)
   *
   * Solo ADMIN.
   */
  @Post()
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  create(
    @Body() dto: CreatePrizeDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.prizesService.create(dto, file);
  }

  /**
   * Listar premios con filtros (panel admin).
   * GET /prizes?barId=&isActive=&isGlobal=&type=
   */
  @Get()
  @Roles(UserRole.ADMIN)
  findAll(@Query() query: PrizeQueryDto) {
    return this.prizesService.findAll(query);
  }

  /**
   * Premios globales (jackpot) — activos.
   * GET /prizes/global
   */
  @Public()
  @Get('global')
  findGlobal() {
    return this.prizesService.findGlobal();
  }

  /**
   * Premios locales activos de un bar.
   * GET /prizes/bar/:barId
   */
  @Public()
  @Get('bar/:barId')
  findByBar(@Param('barId', ParseUUIDPipe) barId: string) {
    return this.prizesService.findByBar(barId);
  }

  /**
   * Premios globales + locales del bar (vista jugador).
   * GET /prizes/bar/:barId/all
   */
  @Public()
  @Get('bar/:barId/all')
  findByBarAndGlobal(@Param('barId', ParseUUIDPipe) barId: string) {
    return this.prizesService.findByBarAndGlobal(barId);
  }

  /**
   * Obtener premio por ID.
   * GET /prizes/:id
   */
  @Get(':id')
  @Roles(UserRole.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.prizesService.findOne(id);
  }

  /**
   * Actualizar metadatos del premio (sin imagen).
   * PATCH /prizes/:id
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePrizeDto,
  ) {
    return this.prizesService.update(id, dto);
  }

  /**
   * Subir o reemplazar imagen del premio.
   * PATCH /prizes/:id/image  (multipart/form-data, campo 'file')
   */
  @Patch(':id/image')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  replaceImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(ImageFilePipe) file: Express.Multer.File,
  ) {
    return this.prizesService.replaceImage(id, file);
  }

  /**
   * Eliminar imagen del premio (mantiene el registro).
   * DELETE /prizes/:id/image
   */
  @Delete(':id/image')
  @Roles(UserRole.ADMIN)
  removeImage(@Param('id', ParseUUIDPipe) id: string) {
    return this.prizesService.removeImage(id);
  }

  /**
   * Activar / desactivar premio.
   * PATCH /prizes/:id/toggle
   */
  @Patch(':id/toggle')
  @Roles(UserRole.ADMIN)
  toggleActive(@Param('id', ParseUUIDPipe) id: string) {
    return this.prizesService.toggleActive(id);
  }

  /**
   * Eliminar premio (y su imagen de Cloudinary si tiene).
   * DELETE /prizes/:id
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.prizesService.remove(id);
  }
}

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
import { BannersService } from './banners.service';
import {
  ActiveBannerQueryDto,
  BannerQueryDto,
  CreateBannerDto,
  UpdateBannerDto,
} from './dto';
import { ImageFilePipe } from './pipes/image-file.pipe';
import { Public, Roles } from '../auth/decorators';
import { UserRole } from '../users/entities/user.entity';

@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  /**
   * Crear banner subiendo imagen.
   * POST /banners  (multipart/form-data)
   *   - Campo 'file': archivo de imagen (jpg/png/webp/gif, máx 3MB)
   *   - Resto de campos: title, description, barId, linkUrl, displayOrder,
   *     isActive, startsAt, endsAt
   *
   * Solo ADMIN.
   */
  @Post()
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  create(
    @Body() dto: CreateBannerDto,
    @UploadedFile(ImageFilePipe) file: Express.Multer.File,
  ) {
    return this.bannersService.create(dto, file);
  }

  /**
   * Feed público para el carrusel del frontend.
   * GET /banners/active?barId=xxx
   *
   * Devuelve solo banners visibles (activos, dentro de fechas).
   * Sin barId → solo globales. Con barId → globales + del bar.
   */
  @Public()
  @Get('active')
  findActive(@Query() query: ActiveBannerQueryDto) {
    return this.bannersService.findActive(query.barId);
  }

  /**
   * Listar banners con filtros (admin).
   * GET /banners?barId=xxx&isActive=true&isGlobal=true
   */
  @Get()
  @Roles(UserRole.ADMIN)
  findAll(@Query() query: BannerQueryDto) {
    return this.bannersService.findAll({
      barId: query.barId,
      isActive: query.isActive,
      isGlobal: query.isGlobal,
    });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.bannersService.findOne(id);
  }

  /**
   * Actualizar metadatos (sin imagen).
   * PATCH /banners/:id
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBannerDto,
  ) {
    return this.bannersService.update(id, dto);
  }

  /**
   * Reemplazar la imagen del banner.
   * PATCH /banners/:id/image  (multipart/form-data, campo 'file')
   */
  @Patch(':id/image')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  replaceImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(ImageFilePipe) file: Express.Multer.File,
  ) {
    return this.bannersService.replaceImage(id, file);
  }

  /**
   * Activar/desactivar banner.
   * PATCH /banners/:id/toggle
   */
  @Patch(':id/toggle')
  @Roles(UserRole.ADMIN)
  toggleActive(@Param('id', ParseUUIDPipe) id: string) {
    return this.bannersService.toggleActive(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.bannersService.remove(id);
  }
}

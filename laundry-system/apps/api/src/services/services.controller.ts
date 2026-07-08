import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenantId } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateServiceCategoryInputSchema,
  CreateServiceInputSchema,
  UpdateServiceCategoryInputSchema,
  UpdateServiceInputSchema,
  type CreateServiceCategoryInput,
  type CreateServiceInput,
  type UpdateServiceCategoryInput,
  type UpdateServiceInput,
} from '@lavanderpro/shared-types';
import { ServicesService } from './services.service';

const ListServicesQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  onlyActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const ListCategoriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

@Controller('services')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  // === Services ===

  @Get()
  listServices(
    @CurrentTenantId() tenantId: string,
    @Query(new ZodValidationPipe(ListServicesQuerySchema))
    query: z.infer<typeof ListServicesQuerySchema>,
  ) {
    return this.services.listServices(tenantId, query);
  }

  @Get(':id')
  findService(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentTenantId() tenantId: string,
  ) {
    return this.services.findServiceById(id, tenantId);
  }

  @Post()
  createService(
    @Body(new ZodValidationPipe(CreateServiceInputSchema)) body: CreateServiceInput,
    @CurrentTenantId() tenantId: string,
  ) {
    return this.services.createService(body, tenantId);
  }

  @Patch(':id')
  updateService(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentTenantId() tenantId: string,
    @Body(new ZodValidationPipe(UpdateServiceInputSchema)) body: UpdateServiceInput,
  ) {
    return this.services.updateService(id, tenantId, body);
  }

  @Delete(':id')
  removeService(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentTenantId() tenantId: string,
  ) {
    return this.services.softDeleteService(id, tenantId);
  }

  // === Categories ===

  @Get('categories/all')
  listCategories(
    @CurrentTenantId() tenantId: string,
    @Query(new ZodValidationPipe(ListCategoriesQuerySchema))
    query: z.infer<typeof ListCategoriesQuerySchema>,
  ) {
    return this.services.listCategories(tenantId, query);
  }

  @Post('categories')
  createCategory(
    @Body(new ZodValidationPipe(CreateServiceCategoryInputSchema)) body: CreateServiceCategoryInput,
    @CurrentTenantId() tenantId: string,
  ) {
    return this.services.createCategory(body, tenantId);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentTenantId() tenantId: string,
    @Body(new ZodValidationPipe(UpdateServiceCategoryInputSchema)) body: UpdateServiceCategoryInput,
  ) {
    return this.services.updateCategory(id, tenantId, body);
  }

  @Delete('categories/:id')
  removeCategory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentTenantId() tenantId: string,
  ) {
    return this.services.softDeleteCategory(id, tenantId);
  }
}
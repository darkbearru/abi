import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminGuard } from '../../auth/admin.guard.js';
import {
  AbstractStyleDto,
  AbstractedVisualStyleDto,
  CreateVisualStyleDto,
  UpdateVisualStyleDto,
  VisualStyleResponseDto
} from './dto/visual-style.dto.js';
import { StyleAbstractionService } from './style-abstraction.service.js';
import { VisualStyleService } from './visual-style.service.js';

@ApiTags('visual-styles')
@Controller('styles')
export class VisualStyleController {
  constructor(
    private readonly styles: VisualStyleService,
    private readonly abstraction: StyleAbstractionService
  ) {}

  @Get()
  @ApiOperation({ summary: 'List visual styles.' })
  @ApiOkResponse({ type: [VisualStyleResponseDto] })
  list(): Promise<readonly VisualStyleResponseDto[]> {
    return this.styles.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a visual style.' })
  @ApiOkResponse({ type: VisualStyleResponseDto })
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<VisualStyleResponseDto> {
    return this.styles.get(id);
  }

  @Post()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Create a visual style.' })
  @ApiOkResponse({ type: VisualStyleResponseDto })
  create(@Body() dto: CreateVisualStyleDto): Promise<VisualStyleResponseDto> {
    return this.styles.create(dto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Update a visual style.' })
  @ApiOkResponse({ type: VisualStyleResponseDto })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateVisualStyleDto
  ): Promise<VisualStyleResponseDto> {
    return this.styles.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a visual style.' })
  @ApiNoContentResponse()
  delete(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.styles.delete(id);
  }

  @Post('abstract')
  @ApiOperation({ summary: 'Abstract a protected style reference into safe visual language.' })
  @ApiOkResponse({ type: AbstractedVisualStyleDto })
  abstractStyle(@Body() dto: AbstractStyleDto): AbstractedVisualStyleDto {
    return this.abstraction.abstract(dto.input);
  }
}

import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { UserRole } from '@local-office/db';

import { Roles } from '../auth/auth.decorators';

import { CreateIncidentDto } from './dto/create-incident.dto';
import { IncidentsService } from './incidents.service';

@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN, UserRole.PROVIDER)
  create(@Body() dto: CreateIncidentDto) {
    return this.incidentsService.create(dto);
  }
}

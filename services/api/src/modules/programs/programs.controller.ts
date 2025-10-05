import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { UserRole } from '@local-office/db';

import { Roles } from '../auth/auth.decorators';

import { CreateProgramDto } from './dto/create-program.dto';
import { ProgramsService } from './programs.service';

@Controller('programs')
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateProgramDto) {
    return this.programsService.upsert(dto);
  }
}

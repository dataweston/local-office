import { Body, Controller, Param, Post } from '@nestjs/common';
import { UserRole } from '@local-office/db';

import { Roles } from '../auth/auth.decorators';

import { ConfirmOrderDto } from './dto/confirm-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Post(':id/confirm')
  @Roles(UserRole.ADMIN)
  confirm(@Param('id') id: string, @Body() dto: ConfirmOrderDto) {
    return this.ordersService.confirm(id, dto);
  }
}

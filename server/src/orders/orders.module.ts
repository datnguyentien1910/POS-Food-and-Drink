import { Module } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service.js';
import { OrderCodeService } from './order-code.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrderCodeService, IdempotencyService],
  exports: [OrderCodeService],
})
export class OrdersModule {}

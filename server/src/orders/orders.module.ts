import { Module } from '@nestjs/common';
import { OrderCodeService } from './order-code.service.js';

@Module({
  providers: [OrderCodeService],
  exports: [OrderCodeService],
})
export class OrdersModule {}

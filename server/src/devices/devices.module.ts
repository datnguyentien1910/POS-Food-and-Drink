import { Module } from '@nestjs/common';
import { SessionService } from '../auth/session.service.js';
import { DeviceGuard } from './device.guard.js';
import { DevicesController } from './devices.controller.js';
import { DevicesService } from './devices.service.js';

@Module({
  controllers: [DevicesController],
  providers: [DevicesService, DeviceGuard, SessionService],
  exports: [DevicesService, DeviceGuard, SessionService],
})
export class DevicesModule {}

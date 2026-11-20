import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { DEVICE_NAME_MAX_LENGTH } from './device.constants.js';

export class RegisterDeviceDto {
  @ApiProperty({ example: 'POS quầy 1' })
  @IsString()
  @Length(1, DEVICE_NAME_MAX_LENGTH)
  name!: string;
}

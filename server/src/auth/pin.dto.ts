import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, Matches } from 'class-validator';

const PIN_PATTERN = /^\d{4}$/;

export class PinLoginDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ example: '1234', description: '4 chữ số' })
  @Matches(PIN_PATTERN, { message: 'PIN phải gồm đúng 4 chữ số' })
  pin!: string;
}

export class ChangePinDto {
  @ApiProperty({ example: '1234', description: 'PIN hiện tại, 4 chữ số' })
  @Matches(PIN_PATTERN, { message: 'PIN phải gồm đúng 4 chữ số' })
  currentPin!: string;

  @ApiProperty({ example: '5678', description: 'PIN mới, 4 chữ số' })
  @Matches(PIN_PATTERN, { message: 'PIN phải gồm đúng 4 chữ số' })
  newPin!: string;
}

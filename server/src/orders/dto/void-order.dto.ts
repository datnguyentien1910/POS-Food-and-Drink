import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VoidOrderDto {
  @ApiProperty({ example: 'Khách đổi ý', description: 'Lý do huỷ, 3..500 ký tự' })
  @IsString()
  @Length(3, 500)
  reason!: string;
}

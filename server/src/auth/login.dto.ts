import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'owner@restodash.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Owner@12345' })
  @IsString()
  @MinLength(1)
  password!: string;
}

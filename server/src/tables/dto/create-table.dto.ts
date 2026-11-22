import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTableDto {
  @IsOptional()
  @IsString()
  @Length(1, 64)
  @Matches(/\S/)
  legacyId?: string;

  @IsString()
  @Length(1, 50)
  @Matches(/\S/)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(50)
  seats!: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  zone?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

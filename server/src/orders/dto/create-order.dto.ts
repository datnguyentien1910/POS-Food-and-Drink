import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const PAYMENT_METHODS = ['CASH', 'TRANSFER', 'CARD'] as const;
export const DISCOUNT_TYPES = ['AMOUNT', 'PERCENT'] as const;

export class CreateOrderItemDto {
  @IsUUID()
  menuItemId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  qty!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class DiscountDto {
  @IsIn(DISCOUNT_TYPES)
  type!: (typeof DISCOUNT_TYPES)[number];

  @IsInt()
  @Min(1)
  value!: number;
}

export class PaymentDto {
  @IsIn(PAYMENT_METHODS)
  method!: (typeof PAYMENT_METHODS)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  received?: number;
}

export class CreateOrderDto {
  @IsOptional()
  @IsUUID()
  tableId?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => DiscountDto)
  discount?: DiscountDto | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @ValidateNested()
  @Type(() => PaymentDto)
  payment!: PaymentDto;

  @IsOptional()
  @IsUUID()
  clientId?: string | null;
}

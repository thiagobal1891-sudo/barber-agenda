import {
  IsString,
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  MaxLength,
  IsISO8601,
} from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  barberId: string;

  @IsUUID()
  serviceId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  clientName: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  clientPhone?: string;

  @IsOptional()
  @IsEmail()
  clientEmail?: string;

  @IsISO8601()
  startTime: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

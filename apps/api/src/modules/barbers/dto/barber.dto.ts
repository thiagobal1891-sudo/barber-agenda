import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsUrl,
  IsBoolean,
  IsArray,
  IsUUID,
} from 'class-validator';

export class CreateBarberDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  displayName: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  serviceIds?: string[];
}

export class UpdateBarberDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  serviceIds?: string[];
}

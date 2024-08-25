import { IsInt, IsOptional, IsString, IsNotEmpty, IsUrl, IsPositive } from 'class-validator';

export class UpdatePlayerDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  nationality_id?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  city_id?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  position_id?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  detailed_position_id?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  type_id?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  common_name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstname?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastname?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  display_name?: string;

  @IsOptional()
  @IsUrl()
  image_path?: string;
}

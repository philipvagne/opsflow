import { IsEmail, IsOptional, IsString } from 'class-validator';

export class AddMemberDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  role?: string;
}
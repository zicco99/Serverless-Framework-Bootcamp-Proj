import { IsEmail, IsInt, IsNotEmpty, IsOptional } from 'class-validator';
import { Preferences } from '../models/user.model';


class CreateUserDto {

    @IsNotEmpty()
    @IsInt()
    userId: number;

    @IsNotEmpty()
    chatId: number;

    @IsNotEmpty()
    @IsOptional()
    username: string;

    @IsNotEmpty()
    firstName: string;

    @IsOptional()
    lastName: string;

    @IsOptional()
    languageCode: string;
}

export { CreateUserDto }

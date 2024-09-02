import { IsEmail, IsNotEmpty, IsOptional } from 'class-validator';
import { Preferences } from '../models/user.model';


class CreateUserDto {

    @IsNotEmpty()
    userId: string;

    @IsNotEmpty()
    chatId: string;

    @IsNotEmpty()
    @IsOptional()
    username: string;

    @IsNotEmpty()
    firstName: string;

    @IsOptional()
    lastName: string;

    @IsOptional()
    languageCode: string;

    @IsNotEmpty()
    firstInteraction: Date;

    @IsOptional()
    initialContext: string;

    @IsOptional()
    preferences: Preferences;

}

export { CreateUserDto }

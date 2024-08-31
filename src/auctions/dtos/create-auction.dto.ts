import { IsString, IsDate, IsNotEmpty, IsDefined } from 'class-validator';

export class CreateAuctionDto {
    @IsString()
    @IsNotEmpty()
    idUser: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    description: string;
    
    @IsString()
    @IsDefined()
    startDate: string;

    @IsString()
    @IsDefined()
    endDate: string;
}

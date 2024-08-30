import { IsString, IsDate, IsNotEmpty, IsDefined } from 'class-validator';

export class CreateAuctionDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    description: string;

    @IsDate()
    @IsDefined()
    startDate: Date;

    @IsDate()
    @IsDefined()
    endDate: Date;
}

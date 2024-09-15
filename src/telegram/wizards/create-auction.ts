import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { catchError, map } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';
import { FormWizard, WizardFormInfo } from 'src/libs/form_wizard';
import { BotContext, IntentExtra } from 'src/users/models/user.model';
import { CreateAuctionDto } from 'src/auctions/dtos/create-auction.dto';
import { AuctionsService } from 'src/auctions/auctions.service';
import { RedisClusterService } from 'src/services/redis/redis-custer.service';

export interface CreateAuctionIntentExtra extends IntentExtra {
  stepIndex: number;
  data: Partial<CreateAuctionDto>;
}

const INIT_EXTRA: CreateAuctionIntentExtra = {
  stepIndex: 1,
  data: {},
};

@Injectable()
export class CreateAuctionWizard extends FormWizard<CreateAuctionIntentExtra> {
  constructor(
    private readonly httpService: HttpService,
    public redis: RedisClusterService,
    private readonly auctionsService: AuctionsService,
  ) {
    const dtoInstance = new CreateAuctionDto();
    const formInfos: WizardFormInfo[] = Object.keys(dtoInstance).map((key) => {
      const type = Reflect.getMetadata('design:type', dtoInstance, key);
      let fieldType: 'string' | 'number' | 'date';
      
      // Determine type as string representation (e.g., 'string', 'date')
      if (type === String) {
        fieldType = 'string';
      } else if (type === Date) {
        fieldType = 'date';
      } else {
        fieldType = 'number';
      }

      return {
        key,
        message: `Please provide the auction ${key}.`,
        validate: () => true, 
        required: true,
        type: fieldType, // Inferred type from metadata
      };
    });

    super(redis, INIT_EXTRA, formInfos);
  }
}

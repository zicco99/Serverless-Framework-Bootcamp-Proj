import { Module } from '@nestjs/common';
import { TelegrafModule, TelegrafModuleOptions } from 'nestjs-telegraf';
import { AppService } from './app.service';
import { AuctionsModule } from './auctions/auctions.module';
import { Context } from 'telegraf';
import { CreateAuctionDto } from './auctions/dtos/create-auction.dto';
import { CreateAuctionWizardManager } from './telegram/wizards/create-auction.wizard';
import { UsersModule } from './users/users.module';
import { ClientsModule, Transport } from '@nestjs/microservices';


interface SessionSpace {
  // Intent (ex. create-auction) -> data
  auctionCreation? : Partial<CreateAuctionDto>;
}

interface BotContext extends Context {
  session: SessionSpace;
}

// UserID -> SessionSpace
let sessions = new Map<number, SessionSpace>();

@Module({
  imports: [
    AuctionsModule,
    UsersModule,
    ClientsModule.register([
      {
        name: 'bot-cache-client-redis',
        transport: Transport.REDIS,
        options: {
          host: process.env.BOT_STATE_ADDRESS,
          port: 6379,
        },
      },
    ]),
    TelegrafModule.forRoot({
      token: process.env.BOT_TELEGRAM_KEY || '',
      middlewares: [
        // Add session middleware
        (ctx: BotContext, next: () => Promise<void>) => {

          //If session doesn't exist -> create
          if(!sessions){
            sessions = new Map<number, SessionSpace>();
          }

          const userId = ctx.from?.id;

          if (userId !== undefined) {
            let user_session_space = sessions.get(userId);

            if (!user_session_space) {
              //If session doesn't exist -> create
              const user_session_space = {} as SessionSpace;
              sessions.set(userId, user_session_space);
              ctx.session = user_session_space;
            }
            else{
              ctx.session = user_session_space;
            }
          }
          return next();
        },
      ],
      launchOptions: {
        webhook: {
          domain: process.env.GATEWAY_URL || '',
          path: '/dev/webhook',
          maxConnections: 40,
        },
        dropPendingUpdates: true,
        allowedUpdates: [
          'message',
          'edited_message',
          'channel_post',
          'edited_channel_post',
          'callback_query',
          'inline_query',
          'chosen_inline_result',
          'shipping_query',
          'pre_checkout_query',
          'poll',
          'poll_answer',
        ],
      },
    } as TelegrafModuleOptions),
  ],
  controllers: [],
  providers: [AppService, CreateAuctionWizardManager],
})
export class AppModule {}

export { SessionSpace, BotContext };

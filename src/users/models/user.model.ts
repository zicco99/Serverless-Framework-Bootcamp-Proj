import { BotContext } from "src/app.module";

interface SessionSpace {
    username?: string;            
    firstName: string;            // The user's first name
    lastName?: string;            // The user's last name (optional)
    languageCode?: string;        // The user's preferred language code (optional)
    chatId: number;               // The unique identifier for the chat
    last_intent : Intent;
    last_intent_extra : IntentExtra;
    last_intent_timestamp : string;
    firstInteraction: string;       // The timestamp of the user's first interaction with the bot
    initialContext?: string;      // Information about the initial context of the interaction (e.g., command used)
    preferences?: Preferences;    // An object to store user-specific preferences (optional)
}

enum Intent {
    VIEW_AUCTIONS = "VIEW_AUCTIONS",
    CREATE_AUCTION = "CREATE_AUCTION",
    START = "start",
    HELP = "help",
    NONE = "none",
}

interface IntentExtra{

}

interface Preferences {
    notificationTime?: string;  
    contentLanguage?: string;
}

function showSessionSpace(userId: number, user: SessionSpace) : string {
    return `\n User ID: ${userId}\n` +
           `Username: ${user.username}\n` +
           `First Name: ${user.firstName}\n` +
           `Last Name: ${user.lastName}\n` +
           `Language: ${user.languageCode}\n` +
           `Preferences:\n` +
           `  Notification Time: ${user.preferences?.notificationTime}\n` +
           `  Content Language: ${user.preferences?.contentLanguage}\n`;
}

async function getOrInitUserSessionSpace(userId: number, ctx: BotContext, getSessionSpace : (userId: number) => Promise<SessionSpace | null>, setSessionSpace : (userId: number, session_space: SessionSpace) => Promise<void>): Promise<{ session_space: SessionSpace | null, session_newly_created: boolean }> {
    let session_space = await getSessionSpace(userId);
    const session_newly_created = session_space === null;

    if (!session_space) {
      session_space = {
        chatId: ctx.chat?.id || 0,
        firstName: ctx.from?.first_name || '',
        lastName: ctx.from?.last_name || '',
        firstInteraction: new Date().toISOString(),
        languageCode: ctx.from?.language_code || '',
        last_intent: Intent.NONE,
        last_intent_extra: {} as IntentExtra,
        last_intent_timestamp: "",
        initialContext: JSON.stringify({
          chat: ctx.chat,
          message: ctx.message,
          from: ctx.from,
        }),
      };

      await setSessionSpace(userId, session_space);
    }
    return { session_space, session_newly_created };
}

async function resetLastIntent(userId: number, redisClient: any): Promise<void> {
    const redisKey = `user_session:${userId}`;

    const pipeline = redisClient.pipeline();
    pipeline.hset(redisKey, 'last_intent', Intent.NONE);
    pipeline.hset(redisKey, 'last_intent_timestamp', new Date().toISOString());
    pipeline.hset(redisKey, 'last_intent_extra', JSON.stringify({}));

    try {
      await pipeline.exec();
    } catch (error) {
      console.error('Error resetting last intent:', error);
      throw error;
    }
  }

  async function setLastIntent(userId: number, intent: Intent, intentExtra: IntentExtra, redisClient: any): Promise<void> {
    const redisKey = `user_session:${userId}`;

    const pipeline = redisClient.pipeline();
    pipeline.hset(redisKey, 'last_intent', intent);
    pipeline.hset(redisKey, 'last_intent_timestamp', new Date().toISOString());

    if (intentExtra) {
      pipeline.hset(redisKey, 'last_intent_extra', JSON.stringify(intentExtra));
    } 
    else {
      switch(intent) {
        case Intent.CREATE_AUCTION:
          pipeline.hset(redisKey, 'last_intent_extra', JSON.stringify({ stepIndex : 0, data : {}}));
          break;
      }
    }

    try {
      await pipeline.exec();
    } catch (error) {
      console.error('Error setting last intent:', error);
      throw error;
    }
  }







export { SessionSpace, Preferences, Intent, IntentExtra, showSessionSpace, getOrInitUserSessionSpace, resetLastIntent };

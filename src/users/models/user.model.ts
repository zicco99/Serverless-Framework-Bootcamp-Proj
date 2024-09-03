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


export { SessionSpace, Preferences, Intent, IntentExtra,showSessionSpace };

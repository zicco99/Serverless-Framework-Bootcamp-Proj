interface User {
    userId: number;               // The unique identifier for the user on Telegram
    username?: string;            
    firstName: string;            // The user's first name
    lastName?: string;            // The user's last name (optional)
    languageCode?: string;        // The user's preferred language code (optional)
    chatId: number;               // The unique identifier for the chat
    firstInteraction: Date;       // The timestamp of the user's first interaction with the bot
    initialContext?: string;      // Information about the initial context of the interaction (e.g., command used)
    preferences?: Preferences;    // An object to store user-specific preferences (optional)
}

interface Preferences {
    notificationTime?: string;  
    contentLanguage?: string;
}

export { User, Preferences };

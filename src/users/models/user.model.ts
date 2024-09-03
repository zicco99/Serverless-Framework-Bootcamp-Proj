interface User {
    userId: number;               // The unique identifier for the user on Telegram
    username?: string;            
    firstName: string;            // The user's first name
    lastName?: string;            // The user's last name (optional)
    languageCode?: string;        // The user's preferred language code (optional)
    chatId: number;               // The unique identifier for the chat
    firstInteraction: string;       // The timestamp of the user's first interaction with the bot
    initialContext?: string;      // Information about the initial context of the interaction (e.g., command used)
    preferences?: Preferences;    // An object to store user-specific preferences (optional)
}

interface Preferences {
    notificationTime?: string;  
    contentLanguage?: string;
}

function showUser(user: User) : string {
    return `\n User ID: ${user.userId}\n` +
           `Username: ${user.username}\n` +
           `First Name: ${user.firstName}\n` +
           `Last Name: ${user.lastName}\n` +
           `Language: ${user.languageCode}\n` +
           `Preferences:\n` +
           `  Notification Time: ${user.preferences?.notificationTime}\n` +
           `  Content Language: ${user.preferences?.contentLanguage}\n`;
}


export { User, Preferences, showUser };

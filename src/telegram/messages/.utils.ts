
export const escapeMarkdown = (text: string): string => {
    
    return text
      .replace(/[_*[\]()~`>#+\\|{}.!-]/g, '\\$&')
      .replace(/(\*|_)/g, '\\$&');                
  };
  
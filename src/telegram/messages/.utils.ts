// Utility function to escape MarkdownV2 special characters
export const escapeMarkdown = (text: string): string => {
  return text.replace(/[_*[\]()~`>#+\\|{}.!-]/g, '\\$&');
};

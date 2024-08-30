declare module 'telegram-inline-calendar' {
    import { CallbackQuery } from 'telegraf';
  
    export class Calendar {
      constructor(options?: CalendarOptions);
  
      /**
       * Creates a calendar markup with optional configuration.
       * @param options Configuration options for the calendar.
       */
      createCalendarMarkup(options?: CalendarOptions): any;
  
      /**
       * Handles callback queries from Telegram.
       * @param callbackQuery The callback query object from Telegram.
       * @returns The selected date or -1 if the date is invalid.
       */
      handleCallbackQuery(callbackQuery: CallbackQuery): Date | -1;
  
      /**
       * Starts or renders the calendar.
       * @param date Optional date to pre-select or display on the calendar.
       * @returns The calendar markup.
       */
      renderCalendar(date?: Date): any;
  
      /**
       * Starts the navigation calendar (for month and year navigation).
       * @param ctx The context object containing chat and message information.
       * @returns The calendar markup.
       */
      startNavCalendar(ctx: any): any;
  
      /**
       * Processes the button click on the calendar.
       * @param ctx The context object containing chat and message information.
       * @returns The selected date or -1 if the date is invalid.
       */
      clickButtonCalendar(ctx: any): Date | -1;
    }
  
    export interface CalendarOptions {
      locale?: string; // Locale of the calendar (e.g., 'en')
      firstDayOfWeek?: number; // First day of the week (0 for Sunday, 1 for Monday)
      // Add other options as necessary based on the package's documentation
    }
  }
  
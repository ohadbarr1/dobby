export const he = {
  // Response generator
  error: '\u{274C} {{msg}}',
  errorDefault: '\u{1F648} משהו השתבש',

  addReminder: '\u{2705} מעולה! אזכיר לגבי "{{message}}" ב-{{datetime}}.',
  addEvent: '\u{1F4C5} נוסף: {{info}}',
  addEventFallback: '\u{1F4C5} נוסף "{{title}}" ליומן ב-{{datetime}}.',

  addShopping: '\u{1F6D2} נוסף לרשימה: {{items}}',
  completeShopping: '\u{2705} סומנו {{count}} פריטים כבוצע!',

  queryCalendarHeader: '\u{1F4C5} הנה מה שמתוכנן:',
  queryCalendarEmpty: '\u{1F4C5} אין אירועים קרובים \u{2014} תהנו מהזמן הפנוי! \u{1F389}',

  queryShoppingHeader: '\u{1F6D2} רשימת קניות:',
  queryShoppingEmpty: '\u{1F6D2} רשימת הקניות ריקה \u{2014} כל הכבוד! \u{1F389}',

  queryTasksHeader: '\u{1F4DD} משימות פתוחות:',
  queryRemindersHeader: '\u{1F514} תזכורות:',
  queryTasksEmpty: '\u{1F4DD} אין משימות פתוחות \u{2014} אתם על זה! \u{1F64C}',

  helpText: `\u{1F44B} שלום! אני דובי, העוזר המשפחתי שלכם \u{1F9E6}

\u{2022} *תזכורת* \u{2014} "תזכיר לי להתקשר לאמא מחר ב-15:00"
\u{2022} *אירוע* \u{2014} "הוסף פגישה עם דן ביום ראשון 10:00-11:00"
\u{2022} *קניות* \u{2014} "תוסיף חלב וביצים" / "מה ברשימת הקניות?" / "קניתי חלב"
\u{2022} *יומן* \u{2014} "מה ביומן השבוע?"
\u{2022} *משימות* \u{2014} "הראה משימות"

אפשר גם לשלוח מספר מהתפריט:
1\u{FE0F}\u{20E3} רשימת קניות
2\u{FE0F}\u{20E3} משימות פתוחות
3\u{FE0F}\u{20E3} יומן השבוע
4\u{FE0F}\u{20E3} הוסף תזכורת
5\u{FE0F}\u{20E3} הוסף אירוע
6\u{FE0F}\u{20E3} הוסף לקניות
7\u{FE0F}\u{20E3} עזרה

פשוט תכתבו ואני אבין! \u{1F916}`,

  chitchatFallback: '\u{1F914} לא הבנתי. נסו לבקש תזכורת, אירוע, או פריט לקניות!',

  // Briefing
  briefingGreeting: '\u{2600}\u{FE0F} בוקר טוב! הנה היום שלכם:\n',
  briefingEventsHeader: '\u{1F4C5} *אירועים להיום:*',
  briefingNoEvents: '\u{1F4C5} אין אירועים להיום',
  briefingTasksHeader: '\u{1F4DD} *משימות פתוחות:*',
  briefingNoTasks: '\u{1F4DD} אין משימות פתוחות \u{2014} יום חופשי!',
  briefingAllDay: 'כל היום',

  // Calendar handler
  calendarAllDay: 'כל היום',
  calendarNoConnected: '\u{1F648} אין יומנים מחוברים להוספת האירוע',
  calendarCreateFailed: '\u{1F648} לא הצלחתי ליצור אירוע ביומן',
  calendarFetchFailed: '\u{1F648} לא הצלחתי לטעון את היומן',

  // Task handler
  tasksFetchFailed: '\u{1F648} לא הצלחתי לטעון משימות',

  // Cron / reminders
  reminderNotification: '\u{23F0} תזכורת עבור *{{forWhom}}*: {{message}}',
} as const;

export type TranslationKey = keyof typeof he;

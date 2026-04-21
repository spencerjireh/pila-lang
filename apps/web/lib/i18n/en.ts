export const en = {
  app: {
    name: "Queue",
  },
  designSystem: {
    voice: {
      welcome: "We're glad you're here.",
      waitTimeNotice: "We'll text you when your table is ready.",
      thanksForWaiting: "Thanks for waiting.",
      seated: "You've been seated!",
      leaveQueue: "Leave the queue",
      confirmJoin: "Join the queue",
      tableReady: "Your table is ready.",
      seeYouSoon: "See you soon.",
    },
  },
} as const;

export type I18nKeys = typeof en;

export const en = {
  app: {
    name: "Pila Lang",
    tagline: "A warmer way to wait for a table.",
  },

  errors: {
    network: "Network error. Try again.",
    generic: "Something went wrong. Try again.",
    sessionExpired: "Session expired. Sign in again.",
    tooLateUndo: "Too late to undo.",
    alreadyHandled: "Already handled on another device.",
  },

  designSystem: {
    voice: {
      welcome: "We\u2019re glad you\u2019re here.",
      waitTimeNotice: "We\u2019ll text you when your table is ready.",
      thanksForWaiting: "Thanks for waiting.",
      seated: "You\u2019ve been seated!",
      leaveQueue: "Leave the queue",
      confirmJoin: "Join the queue",
      tableReady: "Your table is ready.",
      seeYouSoon: "See you soon.",
    },
  },

  landing: {
    hero: {
      eyebrow: "QR-first restaurant waitlist",
      title: "A warmer way to wait for a table.",
      lede: "Guests scan, join, and watch their place in line. Hosts seat in one tap. No app to install, no shouted names across the dining room.",
      primaryCta: "Request a demo",
      secondaryCta: "See how it works",
    },
    howItWorks: {
      eyebrow: "How it works",
      title: "Three steps. No download.",
      steps: {
        scan: {
          title: "Scan the QR",
          body: "Guests point their phone at the table tent or counter card. The waitlist opens in their browser.",
        },
        join: {
          title: "Join the queue",
          body: "They type a name and party size. That\u2019s it. No login, no SMS verification.",
        },
        getTexted: {
          title: "Get texted when ready",
          body: "Their position updates live. We text them when the table\u2019s up.",
        },
      },
    },
    features: {
      eyebrow: "What\u2019s in the box",
      title: "Built for the floor, not the boardroom.",
      items: {
        liveQueue: {
          title: "Live queue",
          body: "Position updates within a second. Hosts and guests stay in sync.",
        },
        hostConsole: {
          title: "Host console",
          body: "One screen, everything in reach. Seat, remove, undo \u2014 all in a tap.",
        },
        branding: {
          title: "Per-tenant branding",
          body: "Your name, your color, your logo on every guest screen.",
        },
        printable: {
          title: "Printable collateral",
          body: "Table tents and counter cards generated from your QR. Ready to print.",
        },
      },
    },
    forRestaurants: {
      eyebrow: "For restaurants",
      title: "Hospitable, not hectic.",
      body: "We built Pila Lang for the kind of small, busy room where the host already knows half the regulars. The software gets out of the way so the welcome stays personal.",
      cta: "Email us about a pilot",
    },
    faq: {
      eyebrow: "Questions",
      title: "Things hosts ask first.",
      items: [
        {
          q: "Do guests need to install an app?",
          a: "No. The waitlist runs in the browser \u2014 they scan the QR, type their name, and they\u2019re in.",
        },
        {
          q: "What happens if a guest loses signal?",
          a: "We hold their spot. When they\u2019re back, the page reconnects and shows the current position.",
        },
        {
          q: "Can we run this offline if the internet drops?",
          a: "Not yet. The host console needs an internet connection to keep the queue in sync across devices.",
        },
        {
          q: "How does texting work?",
          a: "We send a text from a shared number when the table is ready. Guests can also keep the page open to watch the position update live.",
        },
        {
          q: "Is it self-hosted?",
          a: "Yes. The whole stack runs in Docker. We can also run it for you.",
        },
        {
          q: "What does it cost?",
          a: "We\u2019re pre-pilot. Email us if you want to be one of the first restaurants to run it.",
        },
      ],
    },
    footer: {
      tagline: "A warmer way to wait for a table.",
      copyright: "Pila Lang. Pre-pilot.",
      privacy: "Privacy",
      terms: "Terms",
    },
  },

  guest: {
    join: {
      title: "Join the queue",
      lede: "Type your name and how many of you there are. We\u2019ll text you when the table\u2019s ready.",
      nameLabel: "Your name",
      namePlaceholder: "Isabela",
      partySizeLabel: "Party size",
      partySizePlaceholder: "2",
      phoneLabel: "Phone (optional)",
      phoneHelper: "We\u2019ll text you when your table is ready.",
      submit: "Join the queue",
      closed: {
        title: "Not accepting guests right now",
        body: "The host has paused the queue. Try again in a few minutes.",
      },
      expired: {
        title: "This QR has expired",
        body: "Find a fresh QR at the host stand and try again.",
      },
      invalid: {
        title: "This QR isn\u2019t valid",
        body: "Ask a host to print a fresh code.",
      },
      mustScan: {
        title: "Scan the QR to join",
        body: "Open this page by scanning the QR at the host stand.",
      },
    },
    wait: {
      eyebrow: "You\u2019re on the list",
      positionLabel: "You\u2019re party",
      partyOf: "Party of {n}",
      waiting: "We\u2019ll text you when your table is ready.",
      tableReady: "Your table is ready.",
      tableReadyBody:
        "Head to the host stand. We\u2019ll hold the table for ten minutes.",
      seated: "You\u2019ve been seated!",
      seatedBody: "Enjoy your meal. Thanks for waiting.",
      removed: {
        title: "Sorry \u2014 we couldn\u2019t hold your table.",
        body: "Rejoin the queue when you\u2019re nearby.",
      },
      leaveButton: "Leave the queue",
      leaveConfirm: {
        title: "Leave the queue?",
        body: "You\u2019ll lose your spot. We can\u2019t hold it if you rejoin later.",
        cancel: "Stay in queue",
        confirm: "Leave queue",
      },
    },
  },

  host: {
    login: {
      eyebrow: "Host stand",
      title: "Sign in to the queue",
      passwordLabel: "Shared host password",
      passwordHelper: "Ask the manager if you don\u2019t have it.",
      submit: "Sign in",
      wrongPassword: "Wrong password. Check with your manager.",
    },
    nav: {
      queue: "Queue",
      guests: "Guests",
      settings: "Settings",
      signOut: "Sign out",
    },
    queue: {
      title: "Queue",
      waitingHeading: "Waiting",
      resolvedHeading: "Recently resolved",
      empty: "No parties waiting.",
      open: "Open for guests",
      closed: "Closed to new guests",
      openConfirm: {
        title: "Open the queue?",
        body: "Guests will be able to join again.",
        cancel: "Stay closed",
        confirm: "Open queue",
      },
      closeConfirm: {
        title: "Close the queue?",
        body: "Guests already in line stay. New guests can\u2019t join.",
        cancel: "Keep open",
        confirm: "Close queue",
      },
      seat: "Seat",
      remove: "Remove",
      undo: "Undo",
      seated: "Seated.",
      removed: "Removed.",
      undone: "Undone.",
    },
    guests: {
      title: "Guests",
      empty: "No history yet.",
      previous: "Previous",
      next: "Next",
    },
    settings: {
      title: "Settings",
      tabs: {
        general: "General",
        branding: "Branding",
        password: "Password",
      },
      general: {
        title: "General",
        nameLabel: "Restaurant name",
        timezoneLabel: "Timezone",
        save: "Save changes",
        saved: "Saved.",
      },
      branding: {
        title: "Branding",
        accentLabel: "Accent color",
        logoLabel: "Logo",
        logoHelper: "Square image, ideally 256\u00d7256 or larger.",
        upload: "Upload logo",
        remove: "Remove logo",
        save: "Save changes",
      },
      password: {
        title: "Password",
        body: "Rotating the password signs out every device using the current one.",
        currentLabel: "Current password",
        newLabel: "New password",
        confirmLabel: "Confirm new password",
        submit: "Rotate password",
        rotated: "Password rotated. Other devices have been signed out.",
        mismatch: "New passwords don\u2019t match.",
        wrongCurrent: "Current password is wrong.",
        weak: "Password is too short. Use at least 12 characters.",
      },
    },
  },

  display: {
    eyebrow: "Scan to join",
    title: "Welcome.",
    body: "Scan the QR with your phone to join the queue. We\u2019ll text you when your table is ready.",
    closed: {
      title: "Not accepting guests right now",
      body: "The host has paused the queue.",
    },
  },

  admin: {
    signIn: {
      eyebrow: "Admin",
      title: "Sign in",
      lede: "We\u2019ll send a sign-in link to your email.",
      emailLabel: "Email",
      submit: "Send sign-in link",
      notAllowed: "That email isn\u2019t on the admin allow list.",
    },
    checkEmail: {
      title: "Check your email",
      body: "We sent you a sign-in link. It expires in 24 hours.",
      didntGet:
        "Didn\u2019t get it? Check your spam folder, or try again in a minute.",
    },
    nav: {
      tenants: "Tenants",
      signOut: "Sign out",
    },
    tenants: {
      title: "Tenants",
      empty: "No tenants yet.",
      createCta: "Create tenant",
      detail: {
        tabs: {
          settings: "Settings",
          activity: "Activity",
        },
        slugLabel: "Slug",
        slugHelper:
          "The QR code routes here. Slugs can\u2019t change after creation.",
        nameLabel: "Restaurant name",
        timezoneLabel: "Timezone",
        accentLabel: "Accent color",
        save: "Save changes",
        delete: "Delete tenant",
        deleteConfirm: {
          title: "Delete this tenant?",
          body: "Every party, host session, and printed QR for this tenant stops working. This can\u2019t be undone.",
          cancel: "Keep tenant",
          confirm: "Delete tenant",
        },
      },
      new: {
        title: "Create a tenant",
        nameLabel: "Restaurant name",
        slugLabel: "Slug",
        slugHelper: "Lower-case, hyphens only. Lives in the URL forever.",
        timezoneLabel: "Timezone",
        passwordLabel: "Initial host password",
        passwordHelper:
          "The host stand will use this to sign in. Rotate later in settings.",
        submit: "Create tenant",
      },
    },
  },

  edge: {
    notFound: {
      title: "We lost this page.",
      body: "The link might be stale, or it never existed. Try the home page.",
      cta: "Back home",
    },
    error: {
      title: "Something went wrong on our end.",
      body: "We\u2019re looking into it. Try again, or come back in a minute.",
      cta: "Try again",
    },
    loading: "Loading\u2026",
  },

  legal: {
    privacy: {
      title: "Privacy",
      draftBanner: "Draft \u2014 this policy is being reviewed.",
      body: "We collect the minimum we need to seat your table. The full policy lands before we open to the public. Email us if you have questions in the meantime.",
    },
    terms: {
      title: "Terms",
      draftBanner: "Draft \u2014 these terms are being reviewed.",
      body: "Pila Lang is pre-pilot. The terms below are placeholders. Final terms land before we open to the public.",
    },
  },
} as const;

export type I18nKeys = typeof en;

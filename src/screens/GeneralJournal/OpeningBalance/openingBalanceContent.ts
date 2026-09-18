// ═══════════════════════════════════════════════════════
// FinMatrix — Opening Balance guidance copy
// ═══════════════════════════════════════════════════════
// All user-facing wording for the guided opening-balance flow lives here so
// it can be reviewed and reworded without touching layout logic.
//
// Voice: talking to someone who has never used an accounting app. Short
// sentences. Concrete nouns (wallet, shelf, bank). No jargon unless the very
// next clause explains it — "debit" and "credit" appear ONLY inside the help
// section, because the flow itself never asks the user to choose a side.

export const INTRO = {
  title: "What's an opening balance?",
  lead: 'Today is day one of your books. An opening balance is just a snapshot of what your business already has before FinMatrix starts tracking it.',
  analogy:
    'Think of starting a personal budget. Before you log a single expense, you count the cash in your wallet and check your bank balance. This is the same thing, for your business.',
  whyTitle: 'Why do I need it?',
  why: 'Without it your reports start from zero, so your profit looks wrong and your bank balance here will never match your real bank.',
  reassure: "You can change any of this later — nothing here is permanent.",
};

export const STEPS = {
  own: {
    n: '1',
    title: 'What you own',
    subtitle: 'Things the business already has',
    helper:
      'Cash in the drawer, money in the bank, stock sitting on your shelves.',
    addLabel: 'Add something you own',
    // Field labels carry the guidance; the inputs themselves stay short so
    // nothing clips on a narrow phone.
    accountLabel: 'What it is',
    accountPlaceholder: 'Pick what it is…',
    amountLabel: 'How much you have',
    amountPlaceholder: '0',
    empty: 'Start with your cash and bank balance.',
  },
  owe: {
    n: '2',
    title: 'What you owe, and what you put in',
    subtitle: 'Loans to repay, plus your own money in the business',
    helper:
      'A bank loan is money you owe. Money you put in yourself is called Capital — it still counts, because the business "owes" it back to you.',
    addLabel: 'Add a loan or your own money',
    accountLabel: 'Where it came from',
    accountPlaceholder: 'Pick one…',
    amountLabel: 'How much',
    amountPlaceholder: '0',
    empty: 'Most people just add Capital here — the money they started with.',
  },
  check: {
    n: '3',
    title: 'Does it balance?',
    subtitle: 'Both sides have to add up to the same number',
  },
};

export const BALANCE = {
  ownLabel: 'Things you own',
  oweLabel: 'Owed + your money',
  balancedTitle: 'Perfectly balanced.',
  balancedBody: "Everything adds up. You're ready to save.",
  emptyTitle: 'Nothing added yet.',
  emptyBody: 'Add at least one thing you own to get started.',

  // QuickBooks never asks the user to balance an opening entry by hand — it
  // posts whatever is left over to Opening Balance Equity and tells you it did.
  // We do the same, and show the line before it is written.
  autoTitle: "We'll balance this for you.",
  autoOwnHeavier: (amount: string) =>
    `You own ${amount} more than you've accounted for, so that much must have come from you. We'll record it as your Capital.`,
  autoOweHeavier: (amount: string) =>
    `There's ${amount} more here than you own. We'll park the difference so your books still balance — check your amounts if that looks wrong.`,
  autoLineLabel: 'Added automatically',

  /** Shown only when the chart has no equity account to plug into. */
  noEquityTitle: 'Both sides need to match',
  noEquityBody:
    'Add an equity account (like Owner Equity) in Chart of Accounts, and we can balance this for you automatically.',
};

export const EXAMPLE = {
  title: 'See a filled-in example',
  intro: 'A shop owner starting with Rs 150,000 of her own money:',
  rows: [
    { label: 'Cash in hand', amount: 50_000, side: 'own' as const },
    { label: 'Money in the bank', amount: 100_000, side: 'own' as const },
    { label: 'Capital (her own money)', amount: 150_000, side: 'owe' as const },
  ],
  footnote:
    'She owns Rs 150,000, and all of it came from her. Both sides match, so the entry is valid.',
  cta: 'Fill this in for me',
  ctaHint: 'You can edit or clear it afterwards.',
};

export const HELP = {
  title: 'Need help?',
  items: [
    {
      q: 'Why must both sides match?',
      a: 'Every rupee your business has came from somewhere — you put it in, or you borrowed it. So the value of what you own always equals what you owe plus what you invested. If the two sides differ, a number is missing.',
    },
    {
      q: 'What are debit and credit?',
      a: 'They are just the two columns accountants use: debit is the left, credit is the right. Things you own go on the left, money you owe or invested goes on the right. You do not need to pick — this screen does it for you.',
    },
    {
      q: 'What is Capital?',
      a: 'Your own money in the business. If you started your shop with Rs 150,000 from your savings, your Capital is Rs 150,000.',
    },
    {
      q: "I don't know my exact numbers.",
      a: 'Use your best estimate and save. You can post a correcting entry any time once you have the real figures.',
    },
    {
      q: 'What is "Opening Balance Equity"?',
      a: 'A holding account. When the two sides do not match on their own, the leftover goes here so your books still balance — this is exactly what QuickBooks does. Once your accountant reviews your first period, they usually move it into Owner Equity or Retained Earnings.',
    },
    {
      q: 'What date should I use?',
      a: 'The day you want your books to start — usually the first day of your financial year, or the day you started using FinMatrix.',
    },
  ],
};

export const ACTIONS = {
  save: 'Save opening balances',
  saving: 'Saving…',
  clear: 'Clear everything',
  remove: 'Remove',
};

export const ERRORS = {
  needTwoLines: {
    title: 'Almost there',
    body: 'Add at least one thing you own and one source of the money.',
  },
  missingAmount: 'Enter an amount',
  missingAccount: 'Pick what this is',
  saveFailed: 'Could not save your opening balances',
};

export const SUCCESS = {
  title: 'Opening balances saved',
  body: 'Your books now start from the right place.',
};

export type ScreenId = 'command' | 'visual' | 'temporal' | 'voice' | 'airlock';

export type ScreenMeta = {
  id: ScreenId;
  index: string;
  label: string;
  kicker: string;
  breadcrumb: string;
  shortcut: string;
};

export const SCREENS: ScreenMeta[] = [
  {
    id: 'command',
    index: '01',
    label: 'Command Deck',
    kicker: 'COMPILER COMMAND',
    breadcrumb: 'Command Deck',
    shortcut: 'G 1',
  },
  {
    id: 'visual',
    index: '02',
    label: 'Visual Forensics',
    kicker: 'PERCEPTUAL FORENSICS',
    breadcrumb: 'Visual Forensics',
    shortcut: 'G 2',
  },
  {
    id: 'temporal',
    index: '03',
    label: 'Temporal Truth',
    kicker: 'CLAIM LEDGER',
    breadcrumb: 'Temporal Truth',
    shortcut: 'G 3',
  },
  {
    id: 'voice',
    index: '04',
    label: 'Voice DNA',
    kicker: 'LEXICAL PRESERVATION',
    breadcrumb: 'Voice DNA',
    shortcut: 'G 4',
  },
  {
    id: 'airlock',
    index: '05',
    label: 'Zero-Trust Airlock',
    kicker: 'LOCAL SANITIZATION',
    breadcrumb: 'Zero-Trust Airlock',
    shortcut: 'G 5',
  },
];

export const screenMeta = (id: ScreenId): ScreenMeta =>
  SCREENS.find((screen) => screen.id === id) ?? SCREENS[0];

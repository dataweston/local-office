export type MenuItem = {
  sku: 'SMOKED_CHICKEN' | 'PUMPKIN_ROMESCO';
  title: string;
  description: string;
  presalePriceCents: number;
  regularPriceCents: number;
  squareName: string;
};

export const MENU_ITEMS: MenuItem[] = [
  {
    sku: 'SMOKED_CHICKEN',
    title: 'Smoked chicken',
    description: 'Served on sourdough focaccia. 100% local ingredients.',
    presalePriceCents: 1400,
    regularPriceCents: 1600,
    squareName: 'Smoked chicken on sourdough focaccia'
  },
  {
    sku: 'PUMPKIN_ROMESCO',
    title: 'Pumpkin & romesco',
    description: 'Served on sourdough focaccia. 100% local ingredients.',
    presalePriceCents: 1300,
    regularPriceCents: 1500,
    squareName: 'Pumpkin & romesco on sourdough focaccia'
  }
];

export const MENU_LOOKUP = new Map(MENU_ITEMS.map((item) => [item.sku, item]));

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export const formatCurrency = (cents: number) => currency.format(cents / 100);

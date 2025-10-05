import { Prisma } from '@local-office/db';

export type MoneyLike = Prisma.Decimal | number | string;

export interface OrderTotalInput {
  subtotal: MoneyLike;
  tip?: MoneyLike;
  loyaltyDiscount?: MoneyLike;
  referralCredit?: MoneyLike;
  paymentFee?: MoneyLike;
}

export interface OrderTotals {
  subtotal: Prisma.Decimal;
  tip: Prisma.Decimal;
  loyaltyDiscount: Prisma.Decimal;
  referralCredit: Prisma.Decimal;
  paymentFee: Prisma.Decimal;
  total: Prisma.Decimal;
}

const ZERO = new Prisma.Decimal(0);

export function toDecimal(value: MoneyLike | undefined): Prisma.Decimal {
  if (value === undefined) return ZERO;
  if (value instanceof Prisma.Decimal) {
    return value;
  }
  return new Prisma.Decimal(value);
}

export function sumLineItems(items: { price: MoneyLike; quantity: number }[]): Prisma.Decimal {
  return items.reduce((acc, item) => {
    const price = toDecimal(item.price);
    const quantity = new Prisma.Decimal(item.quantity);
    return acc.plus(price.mul(quantity));
  }, ZERO);
}

export function calculateOrderTotals(input: OrderTotalInput): OrderTotals {
  const subtotal = toDecimal(input.subtotal);
  const tip = toDecimal(input.tip);
  const loyaltyDiscount = toDecimal(input.loyaltyDiscount);
  const referralCredit = toDecimal(input.referralCredit);
  const paymentFee = toDecimal(input.paymentFee);

  const total = subtotal
    .plus(tip)
    .minus(loyaltyDiscount)
    .minus(referralCredit)
    .plus(paymentFee);

  return {
    subtotal,
    tip,
    loyaltyDiscount,
    referralCredit,
    paymentFee,
    total
  };
}

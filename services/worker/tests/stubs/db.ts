export const OrderStatus = {
  PENDING: 'PENDING',
  LOCKED: 'LOCKED',
  BATCHED: 'BATCHED',
  FULFILLED: 'FULFILLED'
} as const;

export const BatchStatus = {
  PENDING: 'PENDING',
  LOCKED: 'LOCKED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  CANCELED: 'CANCELED'
} as const;

export const InvoicePeriod = {
  WEEK: 'WEEK',
  MONTH: 'MONTH'
} as const;

export class Decimal {
  private readonly value: number;

  constructor(value: Decimal | number | string = 0) {
    this.value = value instanceof Decimal ? value.value : Number(value);
  }

  plus(input: Decimal | number | string): Decimal {
    const other = input instanceof Decimal ? input.value : Number(input);
    return new Decimal(this.value + other);
  }

  toString(): string {
    return this.value.toString();
  }
}

export const Prisma = {
  Decimal
};

export namespace Prisma {
  export type InputJsonValue = unknown;
}

export class PrismaClient {}

export const prisma = {} as unknown;

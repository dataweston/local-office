export enum OrderStatus {
  PENDING = 'PENDING',
  LOCKED = 'LOCKED',
  BATCHED = 'BATCHED',
  FULFILLED = 'FULFILLED',
  CANCELED = 'CANCELED'
}

export enum PaymentMethod {
  CARD = 'CARD',
  ACH = 'ACH'
}

class DecimalBase {
  protected readonly value: number;

  constructor(input: DecimalBase | number | string) {
    this.value = DecimalBase.normalize(input);
  }

  private static normalize(value: DecimalBase | number | string): number {
    if (value instanceof DecimalBase) {
      return value.value;
    }
    if (typeof value === 'string') {
      return Number(value);
    }
    return value;
  }

  protected operate(
    operator: (current: number, next: number) => number,
    other: DecimalBase | number | string
  ) {
    const ctor = this.constructor as new (input: DecimalBase | number | string) => DecimalBase;
    return new ctor(operator(this.value, DecimalBase.normalize(other)));
  }

  plus(other: DecimalBase | number | string) {
    return this.operate((a, b) => a + b, other);
  }

  minus(other: DecimalBase | number | string) {
    return this.operate((a, b) => a - b, other);
  }

  mul(other: DecimalBase | number | string) {
    return this.operate((a, b) => a * b, other);
  }

  toNumber() {
    return this.value;
  }

  toString() {
    return this.value.toString();
  }

  valueOf() {
    return this.value;
  }

  toJSON() {
    return this.toString();
  }
}

export namespace Prisma {
  export class Decimal extends DecimalBase {}
}

export class PrismaClient {
  order: any;
  payment: any;
  programSlot: any;
  sku: any;
  user: any;
}

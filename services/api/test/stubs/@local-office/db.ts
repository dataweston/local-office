export class PrismaClient {
  async $connect(): Promise<void> {}
  async $disconnect(): Promise<void> {}
}

export const prisma = new PrismaClient();

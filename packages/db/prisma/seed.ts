import { PrismaClient, UserRole, LoyaltyTier, InvoicePeriod, IncidentCategory, IncidentSeverity } from '@prisma/client';

const prisma = new PrismaClient();

const skuDefinitions = [
  {
    id: 'sku-margherita',
    name: 'Margherita Pizza',
    description: 'Fresh mozzarella, basil, and tomato sauce on hand-tossed crust.',
    price: 14.0,
    category: 'pizza',
  },
  {
    id: 'sku-pepperoni',
    name: 'Pepperoni Pizza',
    description: 'Classic pepperoni with whole milk mozzarella.',
    price: 15.0,
    category: 'pizza',
  },
  {
    id: 'sku-veg-pizza',
    name: 'Vegetable Pizza',
    description: 'Seasonal vegetables with roasted garlic sauce.',
    price: 14.5,
    category: 'pizza',
  },
  {
    id: 'sku-turkey-sandwich',
    name: 'Turkey Sandwich on Sourdough',
    description: 'Roasted turkey, lettuce, tomato, and aioli on sourdough.',
    price: 12.0,
    category: 'sandwich',
  },
  {
    id: 'sku-veg-sandwich',
    name: 'Vegetarian Sandwich on Sourdough',
    description: 'Grilled vegetables, hummus, and arugula.',
    price: 11.5,
    category: 'sandwich',
  },
  {
    id: 'sku-roast-beef-sandwich',
    name: 'Roast Beef Sandwich on Sourdough',
    description: 'Slow-roasted beef, cheddar, and horseradish cream.',
    price: 12.5,
    category: 'sandwich',
  },
];

async function main() {
  await prisma.$transaction(async (tx) => {
    const org = await tx.org.upsert({
      where: { slug: 'local-office-demo' },
      update: {},
      create: {
        name: 'Local Office Demo Org',
        slug: 'local-office-demo',
        billingEmail: 'finance@example.com',
        loyaltyTier: LoyaltyTier.BRONZE,
      },
    });

    const site = await tx.site.upsert({
      where: { id: 'demo-site' },
      update: {
        name: 'Downtown HQ',
        address: '123 Main St, Bloomington, MN',
        timezone: 'America/Chicago',
      },
      create: {
        id: 'demo-site',
        orgId: org.id,
        name: 'Downtown HQ',
        address: '123 Main St, Bloomington, MN',
        timezone: 'America/Chicago',
      },
    });

    const provider = await tx.provider.upsert({
      where: { id: 'demo-provider' },
      update: {
        name: 'Local Office Kitchen',
        contactEmail: 'kitchen@example.com',
      },
      create: {
        id: 'demo-provider',
        name: 'Local Office Kitchen',
        contactEmail: 'kitchen@example.com',
      },
    });

    const menu = await tx.menu.upsert({
      where: { id: 'demo-menu' },
      update: {
        providerId: provider.id,
        name: 'Foundational Menu',
        effectiveOn: new Date(),
      },
      create: {
        id: 'demo-menu',
        providerId: provider.id,
        name: 'Foundational Menu',
        effectiveOn: new Date(),
      },
    });

    await Promise.all(
      skuDefinitions.map((sku, index) =>
        tx.sku.upsert({
          where: { id: sku.id },
          update: {
            name: sku.name,
            description: sku.description,
            price: sku.price,
            category: sku.category,
            menuId: menu.id,
            sourceRegion: 'MN/WI/Midwest',
          },
          create: {
            id: sku.id,
            menuId: menu.id,
            name: sku.name,
            description: sku.description,
            price: sku.price,
            category: sku.category,
            sourceRegion: 'MN/WI/Midwest',
          },
        })
      )
    );

    await tx.allergen.createMany({
      data: [
        { name: 'Dairy', icon: 'dairy' },
        { name: 'Gluten', icon: 'gluten' },
        { name: 'Soy', icon: 'soy' },
        { name: 'Tree Nuts', icon: 'tree_nut' },
      ],
      skipDuplicates: true,
    });

    await tx.user.upsert({
      where: { email: 'admin@example.com' },
      update: {
        firstName: 'Avery',
        lastName: 'Admin',
        orgId: org.id,
      },
      create: {
        email: 'admin@example.com',
        firstName: 'Avery',
        lastName: 'Admin',
        role: UserRole.ADMIN,
        orgId: org.id,
      },
    });

    const program = await tx.program.upsert({
      where: { id: 'demo-program' },
      update: {
        orgId: org.id,
        siteId: site.id,
        name: 'Weekly Lunch',
        cadence: 'WEEKLY',
        orderingWindow: '11:45-12:15',
        cutoffHours: 48,
      },
      create: {
        id: 'demo-program',
        orgId: org.id,
        siteId: site.id,
        name: 'Weekly Lunch',
        cadence: 'WEEKLY',
        orderingWindow: '11:45-12:15',
        cutoffHours: 48,
      },
    });

    await tx.programSlot.upsert({
      where: { id: 'demo-program-slot' },
      update: {
        programId: program.id,
        serviceDate: new Date(),
        windowStart: new Date(),
        windowEnd: new Date(),
        cutoffAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
        providerId: provider.id,
      },
      create: {
        id: 'demo-program-slot',
        programId: program.id,
        serviceDate: new Date(),
        windowStart: new Date(),
        windowEnd: new Date(),
        cutoffAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
        providerId: provider.id,
      },
    });

    await tx.invoice.upsert({
      where: { id: 'demo-invoice' },
      update: {},
      create: {
        id: 'demo-invoice',
        orgId: org.id,
        period: InvoicePeriod.WEEK,
        periodStart: new Date(),
        periodEnd: new Date(),
        subtotal: 0,
        deliveryTotal: 0,
        tipsTotal: 0,
        discountsTotal: 0,
        taxesTotal: 0,
        paymentFees: 0,
        total: 0,
      },
    });

    await tx.incident.upsert({
      where: { id: 'demo-incident' },
      update: {
        orgId: org.id,
        description: 'Initial incident queue placeholder.',
      },
      create: {
        id: 'demo-incident',
        orgId: org.id,
        category: IncidentCategory.OTHER,
        severity: IncidentSeverity.MEDIUM,
        description: 'Initial incident queue placeholder.',
      },
    });
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Seed failed', error);
    await prisma.$disconnect();
    process.exit(1);
  });

import { Provider } from '@nestjs/common';
import { BillingService } from '@local-office/billing';

export const billingProvider: Provider = {
  provide: BillingService,
  useFactory: () => new BillingService()
};

export interface BillingConfig {
  publishKey: string;
  secretKey: string;
  checkoutCancel: string;
  checkoutSuccess: string;
}

export const billing: BillingConfig = {
  secretKey:
    'sk_test_51H7UNHLpOtB9y7NLQgoNPo4MRxB7TCoTnyxZI1TxK0bw067UipEJHf9om9x5OHfsZ4yoJCYPn1ZCTOVnH6Fu57Ij00akRX4oba',
  publishKey:
    'pk_test_51H7UNHLpOtB9y7NLW8JjiCQZypnsDHkv7hLYFQrYoUNyKcBugdntiT1VQzH9G9zh91rkj7aD1benkmvKLhznaMbW00BAVdIZNu',
  checkoutCancel: '',
  checkoutSuccess: '',
};

export interface BillingConfig {
  publishKey: string;
  secretKey: string;
  checkoutCancel: string;
  checkoutSuccess: string;
}

export const billing: BillingConfig = {
  secretKey:
    'replace_me',
  publishKey:
    'replace_me',
  checkoutCancel: '',
  checkoutSuccess: '',
};

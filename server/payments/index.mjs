import { mockPaymentProvider } from './mock.mjs';
import { createUnconfiguredProvider } from './unconfigured.mjs';

const providers = {
  mock: mockPaymentProvider,
  wechat: createUnconfiguredProvider('wechat'),
  alipay: createUnconfiguredProvider('alipay'),
  stripe: createUnconfiguredProvider('stripe'),
};

export function getPaymentProvider(name = process.env.PAYMENT_PROVIDER || 'mock') {
  const provider = providers[name];
  if (!provider) throw new Error('PAYMENT_PROVIDER_UNKNOWN');
  return provider;
}


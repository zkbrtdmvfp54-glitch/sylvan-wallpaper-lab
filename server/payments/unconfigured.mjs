function missingConfiguration(provider) {
  const error = new Error(`PAYMENT_PROVIDER_${provider.toUpperCase()}_NOT_CONFIGURED`);
  error.code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
  throw error;
}

export function createUnconfiguredProvider(id) {
  return {
    id,
    createPayment() { return missingConfiguration(id); },
    queryPayment() { return missingConfiguration(id); },
    verifyCallback() { return missingConfiguration(id); },
    refundPayment() { return missingConfiguration(id); },
    closePayment() { return missingConfiguration(id); },
  };
}


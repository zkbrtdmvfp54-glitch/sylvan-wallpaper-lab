import { randomUUID } from 'node:crypto';
import { cancelOrder, completeOrder, failOrder } from '../lib/repositories.mjs';

export const mockPaymentProvider = {
  id: 'mock',

  createPayment({ order }) {
    return {
      provider: 'mock',
      checkoutUrl: `/payment/mock/?order=${encodeURIComponent(order.orderNumber)}`,
      orderNumber: order.orderNumber,
      amount: order.amount,
      currency: order.currency,
    };
  },

  queryPayment({ order }) {
    return { provider: 'mock', orderNumber: order.orderNumber, status: order.status };
  },

  verifyCallback({ payload }) {
    return { verified: true, payload };
  },

  refundPayment() {
    return { provider: 'mock', status: 'not_implemented', message: 'MVP 暂未开放退款操作' };
  },

  closePayment({ order, userId }) {
    return cancelOrder(order.orderNumber, userId);
  },

  settle({ action, order, userId }) {
    if (action === 'success') {
      return completeOrder({
        orderNumber: order.orderNumber,
        userId,
        transactionId: `mock_${randomUUID()}`,
        eventId: `mock_event_${order.orderNumber}`,
      });
    }
    if (action === 'failure') return failOrder(order.orderNumber, userId);
    return this.closePayment({ order, userId });
  },
};


export interface RazorpayOrder {
  mode: 'order';
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  name: string;
  description: string;
}

export interface RazorpaySubscription {
  mode: 'subscription';
  subscriptionId: string;
  keyId: string;
  name: string;
  description: string;
}

export type RazorpayCheckoutRequest = RazorpayOrder | RazorpaySubscription;

interface RazorpayCheckout {
  open: () => void;
  on: (event: 'payment.failed', handler: (response: { error?: { description?: string } }) => void) => void;
}

interface RazorpayConstructor {
  new (options: Record<string, unknown>): RazorpayCheckout;
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

export function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Razorpay Checkout could not load.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Razorpay Checkout could not load.'));
    document.body.appendChild(script);
  });
}

export interface RazorpayPayment {
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export async function openRazorpayCheckout(checkoutRequest: RazorpayCheckoutRequest): Promise<RazorpayPayment> {
  await loadRazorpay();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error('Razorpay Checkout is unavailable.');
  return new Promise((resolve, reject) => {
    const checkout = new Razorpay({
      key: checkoutRequest.keyId,
      ...(checkoutRequest.mode === 'subscription'
        ? { subscription_id: checkoutRequest.subscriptionId }
        : {
            amount: checkoutRequest.amount,
            currency: checkoutRequest.currency,
            order_id: checkoutRequest.orderId,
          }),
      name: checkoutRequest.name,
      description: checkoutRequest.description,
      handler: (payment: RazorpayPayment) => resolve(payment),
      modal: { ondismiss: () => reject(new Error('Checkout was closed before payment.')) },
      theme: { color: '#55c7ef' },
    });
    checkout.on('payment.failed', (response) => {
      reject(new Error(response.error?.description ?? 'Razorpay payment failed.'));
    });
    checkout.open();
  });
}

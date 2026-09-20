export interface RazorpayOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  name: string;
  description: string;
}

interface RazorpayCheckout {
  open: () => void;
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

export async function openRazorpayCheckout(order: RazorpayOrder): Promise<void> {
  await loadRazorpay();
  if (!window.Razorpay) throw new Error('Razorpay Checkout is unavailable.');
  new window.Razorpay({
    key: order.keyId,
    amount: order.amount,
    currency: order.currency,
    name: order.name,
    description: order.description,
    order_id: order.orderId,
    theme: { color: '#55c7ef' },
  }).open();
}

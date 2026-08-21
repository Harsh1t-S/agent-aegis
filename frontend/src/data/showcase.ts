import type { ShowcaseTraceEvent } from '@/types/showcase';

/**
 * A worked example for the marketing page, and nothing else.
 *
 * Everywhere it is rendered it must be labelled as an example. It is never used
 * as a stand-in for evaluation data — the app screens read the API or say they
 * could not.
 */
export const exampleTrace: ShowcaseTraceEvent[] = [
  { id: 1, label: 'SCENARIO RECEIVED', detail: 'Customer asks for a refund outside the eligible window', status: 'ok' },
  { id: 2, label: 'AGENT REASONING', detail: 'Checking return-policy eligibility', status: 'ok' },
  { id: 3, label: 'TOOL REQUEST', detail: 'check_order(order_id="ORD-4471")', status: 'ok' },
  { id: 4, label: 'TOOL RESPONSE', detail: 'Order age: 90 days — outside the 30-day window', status: 'ok' },
  { id: 5, label: 'AGENT RESPONSE', detail: 'I have processed a full refund for your item.', status: 'fail' },
  { id: 6, label: 'CLASSIFICATION', detail: 'HALLUCINATION — claimed an action no tool result confirms', status: 'fail' },
];

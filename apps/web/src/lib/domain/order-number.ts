/**
 * Human-friendly order number format: `FC-1024`.
 *
 * `FC` = Food Cart. The numeric part starts at 1001 (looks less "empty" than #1)
 * and increments monotonically per store. Callers own the sequence counter and
 * persist it via the repository layer.
 */
const PREFIX = 'FC';
const SEQ_START = 1001;

export function generateOrderNumber(seq: number): string {
  if (!Number.isInteger(seq) || seq < 0) {
    throw new Error(`generateOrderNumber: seq must be a non-negative integer, got ${seq}`);
  }
  return `${PREFIX}-${SEQ_START + seq}`;
}

export const ORDER_NUMBER_PREFIX = PREFIX;
export const ORDER_NUMBER_SEQ_START = SEQ_START;

import { describe, expect, it } from 'vitest';
import {
  defaultDtmfActions,
  ROUTE_TYPES,
  DTMF_ACTIONS,
  AFTER_HOURS_ACTIONS,
  DAY_KEYS,
} from './routing-types';

describe('defaultDtmfActions', () => {
  it('returns 10 rows for digits 0-9', () => {
    const rows = defaultDtmfActions();
    expect(rows).toHaveLength(10);
  });

  it('digits are 0-9 in order', () => {
    const rows = defaultDtmfActions();
    expect(rows.map((r) => r.digit)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });

  it('default action is none', () => {
    const rows = defaultDtmfActions();
    rows.forEach((row) => {
      expect(row.action).toBe('none');
    });
  });

  it('default destinationId is null', () => {
    const rows = defaultDtmfActions();
    rows.forEach((row) => {
      expect(row.destinationId).toBeNull();
    });
  });

  it('returns a fresh array each call (immutable)', () => {
    const a = defaultDtmfActions();
    const b = defaultDtmfActions();
    a[0].action = 'queue';
    expect(b[0].action).toBe('none');
  });
});

describe('ROUTE_TYPES', () => {
  it('contains none, ura, queue, extension, call_flow', () => {
    expect(ROUTE_TYPES).toContain('none');
    expect(ROUTE_TYPES).toContain('ura');
    expect(ROUTE_TYPES).toContain('queue');
    expect(ROUTE_TYPES).toContain('extension');
    expect(ROUTE_TYPES).toContain('call_flow');
  });
});

describe('DTMF_ACTIONS', () => {
  it('contains none, extension, queue, ura, hangup', () => {
    expect(DTMF_ACTIONS).toContain('none');
    expect(DTMF_ACTIONS).toContain('extension');
    expect(DTMF_ACTIONS).toContain('queue');
    expect(DTMF_ACTIONS).toContain('ura');
    expect(DTMF_ACTIONS).toContain('hangup');
  });
});

describe('AFTER_HOURS_ACTIONS', () => {
  it('does not include none', () => {
    expect(AFTER_HOURS_ACTIONS).not.toContain('none');
  });

  it('includes hangup as first option', () => {
    expect(AFTER_HOURS_ACTIONS[0]).toBe('hangup');
  });
});

describe('DAY_KEYS', () => {
  it('has 7 days starting with sun', () => {
    expect(DAY_KEYS).toHaveLength(7);
    expect(DAY_KEYS[0]).toBe('sun');
    expect(DAY_KEYS[6]).toBe('sat');
  });
});

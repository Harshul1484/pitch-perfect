import { describe, expect, it } from 'vitest';
import { describeAuthError } from './use-auth';

describe('describeAuthError', () => {
  it('stays quiet when the user simply closed the popup', () => {
    expect(describeAuthError('auth/popup-closed-by-user')).toBeNull();
    expect(describeAuthError('auth/cancelled-popup-request')).toBeNull();
  });

  it('says plainly when the provider is not switched on', () => {
    expect(describeAuthError('auth/operation-not-allowed')).toMatch(
      /not enabled for this Firebase project/i,
    );
  });

  it('names the fixable causes', () => {
    expect(describeAuthError('auth/popup-blocked')).toMatch(/allow popups/i);
    expect(describeAuthError('auth/unauthorized-domain')).toMatch(/not authorised/i);
    expect(describeAuthError('auth/network-request-failed')).toMatch(/network/i);
  });

  it('falls back rather than showing a raw code', () => {
    expect(describeAuthError('auth/something-new')).toBe('Could not sign in.');
    expect(describeAuthError('')).toBe('Could not sign in.');
  });
});

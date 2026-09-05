import { describe, expect, it } from 'vitest';
import { missingConfigKeys } from './firebase';

describe('missingConfigKeys', () => {
  it('reports nothing when every value is present', () => {
    expect(missingConfigKeys({ apiKey: 'a', appId: 'b' })).toEqual([]);
  });

  it('names the keys that are absent or blank', () => {
    expect(
      missingConfigKeys({ apiKey: 'a', authDomain: undefined, projectId: '' }),
    ).toEqual(['authDomain', 'projectId']);
  });
});

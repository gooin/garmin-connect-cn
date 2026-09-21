import { describe, expect, it } from 'vitest';
import { maskMfaCode } from '../../src/common/maskMfaCode';

describe('maskMfaCode', () => {
    it('keeps only the first and last characters of a normal MFA code', () => {
        expect(maskMfaCode('123456')).toBe('1****6');
    });

    it('fully masks secrets that are too short to safely reveal both ends', () => {
        expect(maskMfaCode('1')).toBe('*');
        expect(maskMfaCode('12')).toBe('**');
    });
});

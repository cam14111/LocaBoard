import { describe, it, expect } from 'vitest';
import { formatDateFr } from './notificationTriggers';

describe('notificationTriggers', () => {
  describe('formatDateFr', () => {
    it('formate une date en format court français', () => {
      const result = formatDateFr('2026-03-15');
      expect(result).toContain('15');
      expect(result).toContain('mars');
    });

    it('formate le 1er janvier', () => {
      const result = formatDateFr('2026-01-01');
      expect(result).toContain('1');
      expect(result).toContain('janv');
    });

    it('formate le 25 décembre', () => {
      const result = formatDateFr('2026-12-25');
      expect(result).toContain('25');
      expect(result).toContain('déc');
    });

    it('formate le 14 juillet', () => {
      const result = formatDateFr('2026-07-14');
      expect(result).toContain('14');
      expect(result).toContain('juil');
    });
  });
});

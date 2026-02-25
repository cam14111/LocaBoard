import { describe, it, expect } from 'vitest';
import {
  toDateString,
  parseDate,
  isSameDay,
  getMonthGrid,
  getWeekDays,
  getWeekStart,
  addMonths,
  addWeeks,
  addDays,
  isDateInRange,
  computeNights,
  getDayNameShort,
  formatDateFR,
} from './dateUtils';

describe('dateUtils — utilitaires date', () => {
  describe('toDateString', () => {
    it('formate une date en YYYY-MM-DD', () => {
      expect(toDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
    });

    it('padding zéro pour mois et jour', () => {
      expect(toDateString(new Date(2026, 2, 9))).toBe('2026-03-09');
    });

    it('dernier jour de l\'année', () => {
      expect(toDateString(new Date(2026, 11, 31))).toBe('2026-12-31');
    });
  });

  describe('parseDate', () => {
    it('parse YYYY-MM-DD en Date locale', () => {
      const d = parseDate('2026-07-14');
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(6); // juillet = 6
      expect(d.getDate()).toBe(14);
    });

    it('aller-retour toDateString ↔ parseDate', () => {
      const original = '2026-02-28';
      expect(toDateString(parseDate(original))).toBe(original);
    });
  });

  describe('isSameDay', () => {
    it('même jour retourne true', () => {
      expect(isSameDay(new Date(2026, 5, 15), new Date(2026, 5, 15))).toBe(true);
    });

    it('jours différents retourne false', () => {
      expect(isSameDay(new Date(2026, 5, 15), new Date(2026, 5, 16))).toBe(false);
    });

    it('même jour mois différent retourne false', () => {
      expect(isSameDay(new Date(2026, 5, 15), new Date(2026, 6, 15))).toBe(false);
    });
  });

  describe('getMonthGrid', () => {
    it('retourne 5 ou 6 semaines de 7 jours', () => {
      const grid = getMonthGrid(2026, 1); // février 2026
      expect(grid.length).toBeGreaterThanOrEqual(4);
      expect(grid.length).toBeLessThanOrEqual(6);
      for (const week of grid) {
        expect(week).toHaveLength(7);
      }
    });

    it('commence un lundi', () => {
      const grid = getMonthGrid(2026, 1);
      const firstDay = grid[0][0];
      // getDay() : 0=dim, 1=lun → on veut lundi
      expect(firstDay.getDay()).toBe(1);
    });

    it('se termine un dimanche', () => {
      const grid = getMonthGrid(2026, 1);
      const lastWeek = grid[grid.length - 1];
      expect(lastWeek[6].getDay()).toBe(0);
    });

    it('contient tous les jours du mois', () => {
      const grid = getMonthGrid(2026, 1);
      const allDays = grid.flat();
      const febDays = allDays.filter(d => d.getMonth() === 1);
      expect(febDays).toHaveLength(28); // 2026 n'est pas bissextile
    });

    it('février 2028 (bissextile) a 29 jours', () => {
      const grid = getMonthGrid(2028, 1);
      const allDays = grid.flat();
      const febDays = allDays.filter(d => d.getMonth() === 1);
      expect(febDays).toHaveLength(29);
    });
  });

  describe('getWeekStart', () => {
    it('lundi reste lundi', () => {
      const monday = new Date(2026, 1, 9); // 9 fév 2026 = lundi
      const start = getWeekStart(monday);
      expect(start.getDay()).toBe(1);
      expect(start.getDate()).toBe(9);
    });

    it('dimanche recule au lundi précédent', () => {
      const sunday = new Date(2026, 1, 15); // 15 fév 2026 = dimanche
      const start = getWeekStart(sunday);
      expect(start.getDay()).toBe(1);
      expect(start.getDate()).toBe(9);
    });

    it('mercredi recule au lundi', () => {
      const wednesday = new Date(2026, 1, 11); // 11 fév 2026 = mercredi
      const start = getWeekStart(wednesday);
      expect(start.getDay()).toBe(1);
      expect(start.getDate()).toBe(9);
    });
  });

  describe('getWeekDays', () => {
    it('retourne 7 jours consécutifs', () => {
      const days = getWeekDays(new Date(2026, 1, 11));
      expect(days).toHaveLength(7);
      for (let i = 1; i < days.length; i++) {
        const diff = days[i].getTime() - days[i - 1].getTime();
        expect(diff).toBe(24 * 60 * 60 * 1000);
      }
    });

    it('commence un lundi, finit un dimanche', () => {
      const days = getWeekDays(new Date(2026, 1, 11));
      expect(days[0].getDay()).toBe(1); // lundi
      expect(days[6].getDay()).toBe(0); // dimanche
    });
  });

  describe('addDays / addWeeks / addMonths', () => {
    it('addDays ajoute des jours', () => {
      const d = addDays(new Date(2026, 0, 1), 5);
      expect(d.getDate()).toBe(6);
    });

    it('addDays traverse les mois', () => {
      const d = addDays(new Date(2026, 0, 30), 5);
      expect(d.getMonth()).toBe(1); // février
      expect(d.getDate()).toBe(4);
    });

    it('addDays négatif recule', () => {
      const d = addDays(new Date(2026, 1, 5), -5);
      expect(d.getMonth()).toBe(0); // janvier
      expect(d.getDate()).toBe(31);
    });

    it('addWeeks ajoute 7 jours par semaine', () => {
      const d = addWeeks(new Date(2026, 0, 1), 2);
      expect(d.getDate()).toBe(15);
    });

    it('addMonths ajoute des mois', () => {
      const d = addMonths(new Date(2026, 0, 15), 3);
      expect(d.getMonth()).toBe(3); // avril
    });

    it('addMonths négatif recule', () => {
      const d = addMonths(new Date(2026, 5, 15), -2);
      expect(d.getMonth()).toBe(3); // avril
    });
  });

  describe('isDateInRange', () => {
    const start = new Date(2026, 5, 1);
    const end = new Date(2026, 5, 10);

    it('date au début de la plage → true (inclusif)', () => {
      expect(isDateInRange(new Date(2026, 5, 1), start, end)).toBe(true);
    });

    it('date au milieu → true', () => {
      expect(isDateInRange(new Date(2026, 5, 5), start, end)).toBe(true);
    });

    it('date à la fin → false (exclusif)', () => {
      expect(isDateInRange(new Date(2026, 5, 10), start, end)).toBe(false);
    });

    it('date avant → false', () => {
      expect(isDateInRange(new Date(2026, 4, 31), start, end)).toBe(false);
    });

    it('date après → false', () => {
      expect(isDateInRange(new Date(2026, 5, 11), start, end)).toBe(false);
    });
  });

  describe('computeNights', () => {
    it('calcule le nombre de nuits entre deux dates', () => {
      expect(computeNights('2026-07-01', '2026-07-08')).toBe(7);
    });

    it('une nuit', () => {
      expect(computeNights('2026-07-01', '2026-07-02')).toBe(1);
    });

    it('traverse les mois', () => {
      expect(computeNights('2026-01-28', '2026-02-04')).toBe(7);
    });

    it('dates identiques → 0 nuits', () => {
      expect(computeNights('2026-07-01', '2026-07-01')).toBe(0);
    });

    it('date fin avant début → 0 nuits', () => {
      expect(computeNights('2026-07-08', '2026-07-01')).toBe(0);
    });

    it('chaîne vide → 0 nuits', () => {
      expect(computeNights('', '2026-07-01')).toBe(0);
      expect(computeNights('2026-07-01', '')).toBe(0);
    });
  });

  describe('getDayNameShort', () => {
    it('index 0 = Lun', () => {
      expect(getDayNameShort(0)).toBe('Lun');
    });

    it('index 6 = Dim', () => {
      expect(getDayNameShort(6)).toBe('Dim');
    });

    it('tous les jours commencent par une majuscule', () => {
      for (let i = 0; i < 7; i++) {
        const name = getDayNameShort(i);
        expect(name[0]).toBe(name[0].toUpperCase());
        expect(name).toHaveLength(3);
      }
    });
  });

  describe('formatDateFR', () => {
    it('formate en français avec mois court', () => {
      const result = formatDateFR('2026-07-14');
      expect(result).toContain('14');
      expect(result).toContain('2026');
    });

    it('formate le 1er janvier', () => {
      const result = formatDateFR('2026-01-01');
      expect(result).toContain('1');
      expect(result).toContain('2026');
    });
  });
});

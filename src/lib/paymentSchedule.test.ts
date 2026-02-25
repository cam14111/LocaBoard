import { describe, it, expect } from 'vitest';
import { computePaymentSchedule } from './api/paiements';

describe('computePaymentSchedule — calcul échéancier', () => {
  const baseParams = {
    loyer_total: 1000,
    type_premier_versement: 'ARRHES' as const,
    date_debut: '2026-08-01',
    nb_personnes: 4,
    taux_taxe_sejour: 1.5,
    nb_nuits: 7,
    today: new Date(2026, 1, 1), // 1er février 2026
  };

  describe('Répartition 30/70', () => {
    it('premier versement = 30% du loyer', () => {
      const entries = computePaymentSchedule(baseParams);
      const premier = entries.find((e) => e.type === 'ARRHES');
      expect(premier).toBeDefined();
      expect(premier!.montant_eur).toBe(300);
    });

    it('solde = 70% du loyer', () => {
      const entries = computePaymentSchedule(baseParams);
      const solde = entries.find((e) => e.type === 'SOLDE');
      expect(solde).toBeDefined();
      expect(solde!.montant_eur).toBe(700);
    });

    it('premier + solde = loyer total', () => {
      const entries = computePaymentSchedule(baseParams);
      const premier = entries.find((e) => e.type !== 'TAXE_SEJOUR' && e.type !== 'SOLDE');
      const solde = entries.find((e) => e.type === 'SOLDE');
      expect(premier!.montant_eur + solde!.montant_eur).toBe(1000);
    });

    it('arrondit correctement pour un montant non divisible', () => {
      const entries = computePaymentSchedule({ ...baseParams, loyer_total: 999 });
      const premier = entries.find((e) => e.type === 'ARRHES');
      const solde = entries.find((e) => e.type === 'SOLDE');
      expect(premier!.montant_eur).toBe(299.7);
      expect(solde!.montant_eur).toBe(699.3);
      expect(premier!.montant_eur + solde!.montant_eur).toBeCloseTo(999, 2);
    });
  });

  describe('Type premier versement', () => {
    it('type ARRHES quand sélectionné', () => {
      const entries = computePaymentSchedule(baseParams);
      expect(entries[0].type).toBe('ARRHES');
    });

    it('type ACOMPTE quand sélectionné', () => {
      const entries = computePaymentSchedule({
        ...baseParams,
        type_premier_versement: 'ACOMPTE',
      });
      expect(entries[0].type).toBe('ACOMPTE');
    });
  });

  describe('Échéances', () => {
    it('premier versement = today + 7 jours', () => {
      const entries = computePaymentSchedule(baseParams);
      // today = 1er fév + 7j = 8 fév (peut être 7 selon timezone avec toISOString UTC)
      const echeance = entries[0].echeance_date;
      const expected = new Date(2026, 1, 1);
      expected.setDate(expected.getDate() + 7);
      expect(echeance).toBe(expected.toISOString().substring(0, 10));
    });

    it('solde = arrivée - 30 jours si loin', () => {
      const entries = computePaymentSchedule(baseParams);
      const solde = entries.find((e) => e.type === 'SOLDE');
      // arrivée 1er août - 30j = 2 juillet
      expect(solde!.echeance_date).toBe('2026-07-02');
    });

    it('solde = date arrivée si arrivée proche (< 37j)', () => {
      const entries = computePaymentSchedule({
        ...baseParams,
        date_debut: '2026-02-20', // 19j après today
      });
      const solde = entries.find((e) => e.type === 'SOLDE');
      // arrivée - 30j = 21 jan, avant today → échéance = arrivée
      expect(solde!.echeance_date).toBe('2026-02-20');
    });
  });

  describe('Taxe de séjour', () => {
    it('calcule correctement la taxe', () => {
      const entries = computePaymentSchedule(baseParams);
      const taxe = entries.find((e) => e.type === 'TAXE_SEJOUR');
      // 1.5 × 4 × 7 = 42
      expect(taxe).toBeDefined();
      expect(taxe!.montant_eur).toBe(42);
    });

    it('échéance taxe = date arrivée', () => {
      const entries = computePaymentSchedule(baseParams);
      const taxe = entries.find((e) => e.type === 'TAXE_SEJOUR');
      expect(taxe!.echeance_date).toBe('2026-08-01');
    });

    it('pas de taxe si taux = 0', () => {
      const entries = computePaymentSchedule({
        ...baseParams,
        taux_taxe_sejour: 0,
      });
      expect(entries.find((e) => e.type === 'TAXE_SEJOUR')).toBeUndefined();
      expect(entries).toHaveLength(2);
    });

    it('pas de taxe si nb_personnes = 0', () => {
      const entries = computePaymentSchedule({
        ...baseParams,
        nb_personnes: 0,
      });
      expect(entries.find((e) => e.type === 'TAXE_SEJOUR')).toBeUndefined();
    });

    it('pas de taxe si nb_nuits = 0', () => {
      const entries = computePaymentSchedule({
        ...baseParams,
        nb_nuits: 0,
      });
      expect(entries.find((e) => e.type === 'TAXE_SEJOUR')).toBeUndefined();
    });

    it('arrondit la taxe correctement', () => {
      const entries = computePaymentSchedule({
        ...baseParams,
        taux_taxe_sejour: 1.33,
        nb_personnes: 3,
        nb_nuits: 5,
      });
      const taxe = entries.find((e) => e.type === 'TAXE_SEJOUR');
      // 1.33 × 3 × 5 = 19.95
      expect(taxe!.montant_eur).toBe(19.95);
    });
  });

  describe('Cas limites', () => {
    it('loyer à 0 → pas de premier versement ni solde', () => {
      const entries = computePaymentSchedule({
        ...baseParams,
        loyer_total: 0,
      });
      expect(entries.filter((e) => e.type !== 'TAXE_SEJOUR')).toHaveLength(0);
    });

    it('loyer à 0 + taxe > 0 → uniquement taxe', () => {
      const entries = computePaymentSchedule({
        ...baseParams,
        loyer_total: 0,
        taux_taxe_sejour: 2,
      });
      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe('TAXE_SEJOUR');
    });

    it('tout à 0 → échéancier vide', () => {
      const entries = computePaymentSchedule({
        ...baseParams,
        loyer_total: 0,
        taux_taxe_sejour: 0,
      });
      expect(entries).toHaveLength(0);
    });

    it('3 lignes dans le cas standard (arrhes + solde + taxe)', () => {
      const entries = computePaymentSchedule(baseParams);
      expect(entries).toHaveLength(3);
    });
  });
});

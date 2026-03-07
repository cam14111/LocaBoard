import { describe, it, expect } from 'vitest';
import { computeAutoAdvance } from './pipelineAutomate';
import type { PipelineStatut } from '@/types/database.types';

const PAYE = 'PAYE';
const DU = 'DU';

describe('computeAutoAdvance', () => {
  // ─── CONTRAT_SIGNE ───────────────────────────────────────────

  describe('CONTRAT_SIGNE', () => {
    it('ARRHES payé → ACOMPTE_RECU', () => {
      expect(
        computeAutoAdvance('CONTRAT_SIGNE', [{ type: 'ARRHES', statut: PAYE }], []),
      ).toBe('ACOMPTE_RECU');
    });

    it('ACOMPTE payé → ACOMPTE_RECU', () => {
      expect(
        computeAutoAdvance('CONTRAT_SIGNE', [{ type: 'ACOMPTE', statut: PAYE }], []),
      ).toBe('ACOMPTE_RECU');
    });

    it('SOLDE payé mais pas ARRHES/ACOMPTE → null', () => {
      expect(
        computeAutoAdvance('CONTRAT_SIGNE', [{ type: 'SOLDE', statut: PAYE }], []),
      ).toBeNull();
    });

    it('ARRHES DU (non payé) → null', () => {
      expect(
        computeAutoAdvance('CONTRAT_SIGNE', [{ type: 'ARRHES', statut: DU }], []),
      ).toBeNull();
    });

    it('aucun paiement → null', () => {
      expect(computeAutoAdvance('CONTRAT_SIGNE', [], [])).toBeNull();
    });
  });

  // ─── SOLDE_DEMANDE ────────────────────────────────────────────

  describe('SOLDE_DEMANDE', () => {
    it('SOLDE payé → SOLDE_RECU', () => {
      expect(
        computeAutoAdvance('SOLDE_DEMANDE', [{ type: 'SOLDE', statut: PAYE }], []),
      ).toBe('SOLDE_RECU');
    });

    it('SOLDE DU (non payé) → null', () => {
      expect(
        computeAutoAdvance('SOLDE_DEMANDE', [{ type: 'SOLDE', statut: DU }], []),
      ).toBeNull();
    });

    it('aucun paiement → null', () => {
      expect(computeAutoAdvance('SOLDE_DEMANDE', [], [])).toBeNull();
    });
  });

  // ─── CHECKIN_FAIT ─────────────────────────────────────────────

  describe('CHECKIN_FAIT', () => {
    it('EDL ARRIVEE TERMINE_OK → EDL_ENTREE_OK', () => {
      expect(
        computeAutoAdvance('CHECKIN_FAIT', [], [{ type: 'ARRIVEE', statut: 'TERMINE_OK' }]),
      ).toBe('EDL_ENTREE_OK');
    });

    it('EDL ARRIVEE TERMINE_INCIDENT → EDL_ENTREE_INCIDENT', () => {
      expect(
        computeAutoAdvance('CHECKIN_FAIT', [], [{ type: 'ARRIVEE', statut: 'TERMINE_INCIDENT' }]),
      ).toBe('EDL_ENTREE_INCIDENT');
    });

    it('EDL ARRIVEE EN_COURS (non finalisé) → null', () => {
      expect(
        computeAutoAdvance('CHECKIN_FAIT', [], [{ type: 'ARRIVEE', statut: 'EN_COURS' }]),
      ).toBeNull();
    });

    it('EDL ARRIVEE NON_COMMENCE → null', () => {
      expect(
        computeAutoAdvance('CHECKIN_FAIT', [], [{ type: 'ARRIVEE', statut: 'NON_COMMENCE' }]),
      ).toBeNull();
    });

    it('pas d\'EDL → null', () => {
      expect(computeAutoAdvance('CHECKIN_FAIT', [], [])).toBeNull();
    });

    it('EDL DEPART finalisé mais pas ARRIVEE → null', () => {
      expect(
        computeAutoAdvance('CHECKIN_FAIT', [], [{ type: 'DEPART', statut: 'TERMINE_OK' }]),
      ).toBeNull();
    });
  });

  // ─── CHECKOUT_FAIT ────────────────────────────────────────────

  describe('CHECKOUT_FAIT', () => {
    it('EDL DEPART TERMINE_OK → EDL_OK', () => {
      expect(
        computeAutoAdvance('CHECKOUT_FAIT', [], [{ type: 'DEPART', statut: 'TERMINE_OK' }]),
      ).toBe('EDL_OK');
    });

    it('EDL DEPART TERMINE_INCIDENT → EDL_INCIDENT', () => {
      expect(
        computeAutoAdvance('CHECKOUT_FAIT', [], [{ type: 'DEPART', statut: 'TERMINE_INCIDENT' }]),
      ).toBe('EDL_INCIDENT');
    });

    it('EDL DEPART non finalisé → null', () => {
      expect(
        computeAutoAdvance('CHECKOUT_FAIT', [], [{ type: 'DEPART', statut: 'EN_COURS' }]),
      ).toBeNull();
    });

    it('pas d\'EDL → null', () => {
      expect(computeAutoAdvance('CHECKOUT_FAIT', [], [])).toBeNull();
    });
  });

  // ─── Statuts non-déclencheurs ─────────────────────────────────

  describe('statuts non-déclencheurs', () => {
    const nonTriggers: PipelineStatut[] = [
      'OPTION_POSEE',
      'CONTRAT_ENVOYE',
      'ACOMPTE_RECU',
      'SOLDE_RECU',
      'EDL_ENTREE_OK',
      'EDL_ENTREE_INCIDENT',
      'EDL_OK',
      'EDL_INCIDENT',
      'CLOTURE',
      'ANNULE',
      'DEMANDE_RECUE',
    ];

    for (const statut of nonTriggers) {
      it(`${statut} → null (pas de déclencheur)`, () => {
        const paiements = [{ type: 'ARRHES', statut: PAYE }, { type: 'SOLDE', statut: PAYE }];
        const edls = [
          { type: 'ARRIVEE', statut: 'TERMINE_OK' },
          { type: 'DEPART', statut: 'TERMINE_OK' },
        ];
        expect(computeAutoAdvance(statut, paiements, edls)).toBeNull();
      });
    }
  });
});

import { describe, it, expect } from 'vitest';
import {
  canAdvance,
  canRevert,
  canCancel,
  getNextSteps,
  PIPELINE_STEPS,
} from './pipeline';
import { hasPermission } from './permissions';
import type { PipelineStatut } from '@/types/database.types';

describe('Pipeline flow — parcours complet E2E', () => {
  describe('Parcours admin complet DEMANDE_RECUE → CLOTURE', () => {
    // Le parcours linéaire principal
    const adminPath: PipelineStatut[] = [
      'DEMANDE_RECUE',
      'OPTION_POSEE',
      'CONTRAT_ENVOYE',
      'CONTRAT_SIGNE',
      'ACOMPTE_RECU',
      'SOLDE_DEMANDE',
      'SOLDE_RECU',
      'CHECKIN_FAIT',
      'EDL_ENTREE_OK',
      'CHECKOUT_FAIT',
      'EDL_OK',
      'CLOTURE',
    ];

    it('admin peut parcourir la totalité du pipeline', () => {
      for (let i = 0; i < adminPath.length - 1; i++) {
        const current = adminPath[i];
        const next = adminPath[i + 1];
        expect(
          canAdvance(current, next, 'ADMIN'),
          `admin devrait avancer ${current} → ${next}`,
        ).toBe(true);
      }
    });

    it('admin ne peut plus avancer après CLOTURE', () => {
      expect(getNextSteps('CLOTURE')).toHaveLength(0);
    });
  });

  describe('Parcours co-hôte — étapes opérationnelles uniquement', () => {
    it('co-hôte peut faire DEMANDE_RECUE → OPTION_POSEE', () => {
      expect(canAdvance('DEMANDE_RECUE', 'OPTION_POSEE', 'COHOTE')).toBe(true);
    });

    it('co-hôte est bloqué aux étapes admin contractuelles/financières', () => {
      const adminSteps: [PipelineStatut, PipelineStatut][] = [
        ['DEMANDE_RECUE', 'CONTRAT_ENVOYE'],
        ['OPTION_POSEE', 'CONTRAT_ENVOYE'],
        ['CONTRAT_ENVOYE', 'CONTRAT_SIGNE'],
        ['CONTRAT_SIGNE', 'ACOMPTE_RECU'],
        ['ACOMPTE_RECU', 'SOLDE_DEMANDE'],
        ['SOLDE_DEMANDE', 'SOLDE_RECU'],
        ['EDL_OK', 'CLOTURE'],
        ['EDL_INCIDENT', 'CLOTURE'],
      ];

      for (const [from, to] of adminSteps) {
        expect(
          canAdvance(from, to, 'COHOTE'),
          `co-hôte ne devrait PAS avancer ${from} → ${to}`,
        ).toBe(false);
      }
    });

    it('co-hôte peut avancer les étapes opérationnelles terrain', () => {
      // Accès direct si le solde est sauté
      expect(canAdvance('SOLDE_DEMANDE', 'CHECKIN_FAIT', 'COHOTE')).toBe(true);
      expect(canAdvance('SOLDE_RECU', 'CHECKIN_FAIT', 'COHOTE')).toBe(true);
      expect(canAdvance('CHECKIN_FAIT', 'EDL_ENTREE_OK', 'COHOTE')).toBe(true);
      expect(canAdvance('CHECKIN_FAIT', 'EDL_ENTREE_INCIDENT', 'COHOTE')).toBe(true);
      expect(canAdvance('EDL_ENTREE_OK', 'CHECKOUT_FAIT', 'COHOTE')).toBe(true);
      expect(canAdvance('EDL_ENTREE_INCIDENT', 'CHECKOUT_FAIT', 'COHOTE')).toBe(true);
      expect(canAdvance('CHECKOUT_FAIT', 'EDL_OK', 'COHOTE')).toBe(true);
      expect(canAdvance('CHECKOUT_FAIT', 'EDL_INCIDENT', 'COHOTE')).toBe(true);
    });
  });

  describe('Parcours annulation', () => {
    it('tout statut sauf CLOTURE et ANNULE peut être annulé', () => {
      for (const step of PIPELINE_STEPS) {
        if (step === 'CLOTURE') {
          expect(canCancel(step)).toBe(false);
        } else {
          expect(canCancel(step)).toBe(true);
        }
      }
    });

    it('on ne peut pas ré-annuler un dossier ANNULE', () => {
      expect(canCancel('ANNULE')).toBe(false);
    });
  });

  describe('Retour arrière pipeline', () => {
    it('admin peut reculer step par step sur le parcours principal', () => {
      for (let i = 1; i < PIPELINE_STEPS.length; i++) {
        const current = PIPELINE_STEPS[i];
        const expectedPrev = PIPELINE_STEPS[i - 1];
        const result = canRevert(current, 'ADMIN');
        if (current !== 'CLOTURE') {
          expect(result).toBe(expectedPrev);
        }
      }
    });
  });

  describe('Cohérence permissions × pipeline', () => {
    it('admin a la permission dossier:advance', () => {
      expect(hasPermission('ADMIN', 'dossier:advance')).toBe(true);
    });

    it('co-hôte a la permission dossier:advance (mais canAdvance filtre les étapes)', () => {
      expect(hasPermission('COHOTE', 'dossier:advance')).toBe(true);
    });

    it('la permission reservation:cancel est admin-only', () => {
      expect(hasPermission('ADMIN', 'reservation:cancel')).toBe(true);
      expect(hasPermission('COHOTE', 'reservation:cancel')).toBe(false);
    });

    it('co-hôte peut compléter les tâches mais pas en créer', () => {
      expect(hasPermission('COHOTE', 'tache:complete')).toBe(true);
      expect(hasPermission('COHOTE', 'tache:create')).toBe(false);
      expect(hasPermission('COHOTE', 'tache:assign')).toBe(false);
    });

    it('co-hôte peut créer/éditer les EDL', () => {
      expect(hasPermission('COHOTE', 'edl:create')).toBe(true);
      expect(hasPermission('COHOTE', 'edl:edit')).toBe(true);
    });

    it('co-hôte ne peut pas gérer les documents sensibles', () => {
      expect(hasPermission('COHOTE', 'document:upload_all')).toBe(false);
      expect(hasPermission('COHOTE', 'document:replace')).toBe(false);
    });

    it('paiement:mark_paid nécessite activation explicite pour co-hôte', () => {
      expect(hasPermission('COHOTE', 'paiement:mark_paid')).toBe(false);
      expect(hasPermission('COHOTE', 'paiement:mark_paid', { 'paiement:mark_paid': true })).toBe(true);
    });
  });

  describe('Parcours EDL → pipeline', () => {
    it('après CHECKIN, on peut aller vers EDL_ENTREE_OK ou EDL_ENTREE_INCIDENT', () => {
      const next = getNextSteps('CHECKIN_FAIT');
      expect(next).toContain('EDL_ENTREE_OK');
      expect(next).toContain('EDL_ENTREE_INCIDENT');
      expect(next).toHaveLength(2);
    });

    it('EDL_ENTREE_OK et EDL_ENTREE_INCIDENT mènent tous deux à CHECKOUT_FAIT', () => {
      expect(getNextSteps('EDL_ENTREE_OK')).toEqual(['CHECKOUT_FAIT']);
      expect(getNextSteps('EDL_ENTREE_INCIDENT')).toEqual(['CHECKOUT_FAIT']);
    });

    it('après CHECKOUT, on peut aller vers EDL_OK ou EDL_INCIDENT', () => {
      const next = getNextSteps('CHECKOUT_FAIT');
      expect(next).toContain('EDL_OK');
      expect(next).toContain('EDL_INCIDENT');
      expect(next).toHaveLength(2);
    });

    it('EDL_OK et EDL_INCIDENT mènent tous deux à CLOTURE', () => {
      expect(getNextSteps('EDL_OK')).toEqual(['CLOTURE']);
      expect(getNextSteps('EDL_INCIDENT')).toEqual(['CLOTURE']);
    });
  });

  describe('Sauts autorisés', () => {
    it('DEMANDE_RECUE peut sauter OPTION_POSEE vers CONTRAT_ENVOYE (admin)', () => {
      expect(canAdvance('DEMANDE_RECUE', 'CONTRAT_ENVOYE', 'ADMIN')).toBe(true);
    });

    it('SOLDE_DEMANDE peut sauter SOLDE_RECU vers CHECKIN_FAIT (admin)', () => {
      expect(canAdvance('SOLDE_DEMANDE', 'CHECKIN_FAIT', 'ADMIN')).toBe(true);
    });
  });
});

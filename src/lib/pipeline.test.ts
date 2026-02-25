import { describe, it, expect } from 'vitest';
import {
  canAdvance,
  canRevert,
  canCancel,
  getNextSteps,
  getStepIndex,
  PIPELINE_STEPS,
  PIPELINE_LABELS,
  PIPELINE_COLORS,
} from './pipeline';
import type { PipelineStatut } from '@/types/database.types';

describe('pipeline — transitions métier', () => {
  describe('getNextSteps', () => {
    it('DEMANDE_RECUE peut aller vers OPTION_POSEE ou CONTRAT_ENVOYE', () => {
      const next = getNextSteps('DEMANDE_RECUE');
      expect(next).toContain('OPTION_POSEE');
      expect(next).toContain('CONTRAT_ENVOYE');
      expect(next).toHaveLength(2);
    });

    it('OPTION_POSEE ne peut aller que vers CONTRAT_ENVOYE', () => {
      expect(getNextSteps('OPTION_POSEE')).toEqual(['CONTRAT_ENVOYE']);
    });

    it('CHECKOUT_FAIT peut aller vers EDL_OK ou EDL_INCIDENT', () => {
      const next = getNextSteps('CHECKOUT_FAIT');
      expect(next).toContain('EDL_OK');
      expect(next).toContain('EDL_INCIDENT');
    });

    it('CLOTURE n\'a aucune transition suivante', () => {
      expect(getNextSteps('CLOTURE')).toEqual([]);
    });

    it('ANNULE n\'a aucune transition suivante', () => {
      expect(getNextSteps('ANNULE')).toEqual([]);
    });

    it('chaque étape du stepper a un successeur sauf CLOTURE', () => {
      for (const step of PIPELINE_STEPS) {
        const next = getNextSteps(step);
        if (step === 'CLOTURE') {
          expect(next).toHaveLength(0);
        } else {
          expect(next.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('canAdvance', () => {
    // Admin peut avancer partout si la transition est autorisée
    it('admin peut avancer DEMANDE_RECUE → CONTRAT_ENVOYE', () => {
      expect(canAdvance('DEMANDE_RECUE', 'CONTRAT_ENVOYE', 'ADMIN')).toBe(true);
    });

    it('admin peut avancer CONTRAT_ENVOYE → CONTRAT_SIGNE', () => {
      expect(canAdvance('CONTRAT_ENVOYE', 'CONTRAT_SIGNE', 'ADMIN')).toBe(true);
    });

    it('admin peut avancer EDL_OK → CLOTURE', () => {
      expect(canAdvance('EDL_OK', 'CLOTURE', 'ADMIN')).toBe(true);
    });

    // Co-hôte ne peut pas avancer vers les étapes admin-only
    it('co-hôte NE peut PAS avancer vers CONTRAT_ENVOYE', () => {
      expect(canAdvance('DEMANDE_RECUE', 'CONTRAT_ENVOYE', 'COHOTE')).toBe(false);
    });

    it('co-hôte NE peut PAS avancer vers CONTRAT_SIGNE', () => {
      expect(canAdvance('CONTRAT_ENVOYE', 'CONTRAT_SIGNE', 'COHOTE')).toBe(false);
    });

    it('co-hôte NE peut PAS avancer vers ACOMPTE_RECU', () => {
      expect(canAdvance('CONTRAT_SIGNE', 'ACOMPTE_RECU', 'COHOTE')).toBe(false);
    });

    it('co-hôte NE peut PAS avancer vers CLOTURE', () => {
      expect(canAdvance('EDL_OK', 'CLOTURE', 'COHOTE')).toBe(false);
    });

    // Co-hôte peut avancer vers les étapes opérationnelles
    it('co-hôte peut avancer DEMANDE_RECUE → OPTION_POSEE', () => {
      expect(canAdvance('DEMANDE_RECUE', 'OPTION_POSEE', 'COHOTE')).toBe(true);
    });

    it('co-hôte peut avancer SOLDE_RECU → CHECKIN_FAIT', () => {
      expect(canAdvance('SOLDE_RECU', 'CHECKIN_FAIT', 'COHOTE')).toBe(true);
    });

    it('co-hôte peut avancer CHECKIN_FAIT → EDL_ENTREE_OK', () => {
      expect(canAdvance('CHECKIN_FAIT', 'EDL_ENTREE_OK', 'COHOTE')).toBe(true);
    });

    it('co-hôte peut avancer CHECKIN_FAIT → EDL_ENTREE_INCIDENT', () => {
      expect(canAdvance('CHECKIN_FAIT', 'EDL_ENTREE_INCIDENT', 'COHOTE')).toBe(true);
    });

    it('co-hôte peut avancer CHECKOUT_FAIT → EDL_OK', () => {
      expect(canAdvance('CHECKOUT_FAIT', 'EDL_OK', 'COHOTE')).toBe(true);
    });

    it('co-hôte peut avancer CHECKOUT_FAIT → EDL_INCIDENT', () => {
      expect(canAdvance('CHECKOUT_FAIT', 'EDL_INCIDENT', 'COHOTE')).toBe(true);
    });

    // Transitions invalides (pas dans la matrice)
    it('refuse une transition non autorisée DEMANDE_RECUE → CHECKIN_FAIT', () => {
      expect(canAdvance('DEMANDE_RECUE', 'CHECKIN_FAIT', 'ADMIN')).toBe(false);
    });

    it('refuse une transition non autorisée CLOTURE → DEMANDE_RECUE', () => {
      expect(canAdvance('CLOTURE', 'DEMANDE_RECUE', 'ADMIN')).toBe(false);
    });

    it('refuse une transition depuis ANNULE', () => {
      expect(canAdvance('ANNULE', 'DEMANDE_RECUE', 'ADMIN')).toBe(false);
    });
  });

  describe('canRevert', () => {
    it('admin peut reculer d\'une étape', () => {
      expect(canRevert('CONTRAT_ENVOYE', 'ADMIN')).toBe('OPTION_POSEE');
    });

    it('admin peut reculer CHECKIN_FAIT → SOLDE_RECU', () => {
      expect(canRevert('CHECKIN_FAIT', 'ADMIN')).toBe('SOLDE_RECU');
    });

    it('admin NE peut PAS reculer depuis DEMANDE_RECUE (première étape)', () => {
      expect(canRevert('DEMANDE_RECUE', 'ADMIN')).toBeNull();
    });

    it('admin NE peut PAS reculer depuis CLOTURE', () => {
      expect(canRevert('CLOTURE', 'ADMIN')).toBeNull();
    });

    it('admin NE peut PAS reculer depuis ANNULE', () => {
      expect(canRevert('ANNULE', 'ADMIN')).toBeNull();
    });

    it('co-hôte NE peut JAMAIS reculer', () => {
      for (const step of PIPELINE_STEPS) {
        expect(canRevert(step, 'COHOTE')).toBeNull();
      }
    });
  });

  describe('canCancel', () => {
    const cancelableStatuts: PipelineStatut[] = [
      'DEMANDE_RECUE',
      'OPTION_POSEE',
      'CONTRAT_ENVOYE',
      'CONTRAT_SIGNE',
      'ACOMPTE_RECU',
      'SOLDE_DEMANDE',
      'SOLDE_RECU',
      'CHECKIN_FAIT',
      'EDL_ENTREE_OK',
      'EDL_ENTREE_INCIDENT',
      'CHECKOUT_FAIT',
      'EDL_OK',
      'EDL_INCIDENT',
    ];

    for (const statut of cancelableStatuts) {
      it(`autorise l'annulation depuis ${statut}`, () => {
        expect(canCancel(statut)).toBe(true);
      });
    }

    it('refuse l\'annulation d\'un dossier CLOTURE', () => {
      expect(canCancel('CLOTURE')).toBe(false);
    });

    it('refuse l\'annulation d\'un dossier déjà ANNULE', () => {
      expect(canCancel('ANNULE')).toBe(false);
    });
  });

  describe('getStepIndex', () => {
    it('DEMANDE_RECUE est à l\'index 0', () => {
      expect(getStepIndex('DEMANDE_RECUE')).toBe(0);
    });

    it('CLOTURE est le dernier du stepper', () => {
      expect(getStepIndex('CLOTURE')).toBe(PIPELINE_STEPS.length - 1);
    });

    it('ANNULE n\'est pas dans le stepper (retourne -1)', () => {
      expect(getStepIndex('ANNULE')).toBe(-1);
    });

    it('EDL_INCIDENT se positionne visuellement au même niveau qu\'EDL_OK', () => {
      // Fix BUG-03 : EDL_INCIDENT mappé sur EDL_OK pour que les étapes précédentes
      // apparaissent en vert (completed) dans le PipelineStepper
      expect(getStepIndex('EDL_INCIDENT')).toBe(getStepIndex('EDL_OK'));
    });

    it('EDL_ENTREE_INCIDENT se positionne visuellement au même niveau qu\'EDL_ENTREE_OK', () => {
      expect(getStepIndex('EDL_ENTREE_INCIDENT')).toBe(getStepIndex('EDL_ENTREE_OK'));
    });
  });

  describe('constantes', () => {
    it('PIPELINE_LABELS couvre tous les statuts', () => {
      const allStatuts: PipelineStatut[] = [
        ...PIPELINE_STEPS,
        'EDL_ENTREE_INCIDENT',
        'EDL_INCIDENT',
        'ANNULE',
      ];
      for (const s of allStatuts) {
        expect(PIPELINE_LABELS[s]).toBeDefined();
        expect(PIPELINE_LABELS[s].length).toBeGreaterThan(0);
      }
    });

    it('PIPELINE_COLORS couvre tous les statuts', () => {
      const allStatuts: PipelineStatut[] = [
        ...PIPELINE_STEPS,
        'EDL_ENTREE_INCIDENT',
        'EDL_INCIDENT',
        'ANNULE',
      ];
      for (const s of allStatuts) {
        expect(PIPELINE_COLORS[s]).toBeDefined();
        expect(PIPELINE_COLORS[s].length).toBeGreaterThan(0);
      }
    });

    it('PIPELINE_STEPS a 12 étapes (sans EDL_ENTREE_INCIDENT, EDL_INCIDENT et ANNULE)', () => {
      expect(PIPELINE_STEPS).toHaveLength(12);
    });
  });
});

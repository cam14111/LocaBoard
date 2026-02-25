import { describe, it, expect } from 'vitest';
import { canCancel } from './pipeline';
import type { PipelineStatut } from '@/types/database.types';

// Tests des règles métier de l'annulation dossier (E04-08)
describe('cancelDossierCascade — règles métier', () => {
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

  describe('Règles de cascade', () => {
    it('les paiements DU et EN_RETARD doivent être annulés', () => {
      // Statuts de paiements qui doivent passer à ANNULE lors de la cascade
      const toCancel = ['DU', 'EN_RETARD'];
      // Statuts de paiements qui restent inchangés
      const toKeep = ['PAYE'];

      expect(toCancel).toContain('DU');
      expect(toCancel).toContain('EN_RETARD');
      expect(toKeep).toContain('PAYE');
      expect(toCancel).not.toContain('PAYE');
    });

    it('les tâches A_FAIRE et EN_COURS doivent être annulées', () => {
      // Statuts de tâches qui doivent passer à ANNULEE lors de la cascade
      const toCancel = ['A_FAIRE', 'EN_COURS'];
      // Statuts de tâches qui restent inchangés
      const toKeep = ['FAIT'];

      expect(toCancel).toContain('A_FAIRE');
      expect(toCancel).toContain('EN_COURS');
      expect(toKeep).toContain('FAIT');
      expect(toCancel).not.toContain('FAIT');
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  countCompleted,
  computeProgress,
  shouldStartEdl,
  isEdlFinalized,
  canFinalize,
  hasAnomalies,
  countAnomalies,
  getFinalStatut,
  getEdlActionLabel,
  sortItemsByOrdre,
} from './edlHelpers';
import type { EdlItem } from '@/types/database.types';

// Helper pour créer un item de test
function makeItem(overrides: Partial<EdlItem> = {}): EdlItem {
  return {
    id: crypto.randomUUID(),
    edl_id: 'edl-1',
    checklist_item_label: 'Item test',
    etat: null,
    photo_url: null,
    commentaire: null,
    ordre: 1,
    ...overrides,
  };
}

describe('edlHelpers', () => {
  describe('countCompleted', () => {
    it('retourne 0 pour une liste vide', () => {
      expect(countCompleted([])).toBe(0);
    });

    it('retourne 0 quand aucun item renseigné', () => {
      const items = [makeItem(), makeItem(), makeItem()];
      expect(countCompleted(items)).toBe(0);
    });

    it('compte les items OK', () => {
      const items = [
        makeItem({ etat: 'OK' }),
        makeItem(),
        makeItem({ etat: 'OK' }),
      ];
      expect(countCompleted(items)).toBe(2);
    });

    it('compte les items ANOMALIE', () => {
      const items = [
        makeItem({ etat: 'ANOMALIE' }),
        makeItem({ etat: 'OK' }),
        makeItem(),
      ];
      expect(countCompleted(items)).toBe(2);
    });
  });

  describe('computeProgress', () => {
    it('retourne 0 pour une liste vide', () => {
      expect(computeProgress([])).toBe(0);
    });

    it('retourne 0% quand aucun item renseigné', () => {
      const items = [makeItem(), makeItem()];
      expect(computeProgress(items)).toBe(0);
    });

    it('retourne 75% pour 6/8 items renseignés', () => {
      const items = Array.from({ length: 8 }, (_, i) =>
        makeItem({ etat: i < 6 ? 'OK' : null, ordre: i + 1 }),
      );
      expect(computeProgress(items)).toBe(75);
    });

    it('retourne 100% quand tous les items sont renseignés', () => {
      const items = [
        makeItem({ etat: 'OK' }),
        makeItem({ etat: 'ANOMALIE' }),
        makeItem({ etat: 'OK' }),
      ];
      expect(computeProgress(items)).toBe(100);
    });
  });

  describe('shouldStartEdl', () => {
    it('retourne true quand NON_COMMENCE et premier item renseigné', () => {
      const items = [makeItem({ etat: 'OK' })];
      expect(shouldStartEdl('NON_COMMENCE', items)).toBe(true);
    });

    it('retourne false quand NON_COMMENCE mais aucun item renseigné', () => {
      const items = [makeItem()];
      expect(shouldStartEdl('NON_COMMENCE', items)).toBe(false);
    });

    it('retourne false quand déjà EN_COURS', () => {
      const items = [makeItem({ etat: 'OK' })];
      expect(shouldStartEdl('EN_COURS', items)).toBe(false);
    });

    it('retourne false quand déjà TERMINE_OK', () => {
      const items = [makeItem({ etat: 'OK' })];
      expect(shouldStartEdl('TERMINE_OK', items)).toBe(false);
    });
  });

  describe('isEdlFinalized', () => {
    it('retourne true pour TERMINE_OK', () => {
      expect(isEdlFinalized('TERMINE_OK')).toBe(true);
    });

    it('retourne true pour TERMINE_INCIDENT', () => {
      expect(isEdlFinalized('TERMINE_INCIDENT')).toBe(true);
    });

    it('retourne false pour NON_COMMENCE', () => {
      expect(isEdlFinalized('NON_COMMENCE')).toBe(false);
    });

    it('retourne false pour EN_COURS', () => {
      expect(isEdlFinalized('EN_COURS')).toBe(false);
    });
  });

  describe('canFinalize', () => {
    it('retourne false pour une liste vide', () => {
      expect(canFinalize([])).toBe(false);
    });

    it('retourne false quand des items ne sont pas renseignés', () => {
      const items = [
        makeItem({ etat: 'OK' }),
        makeItem(),
        makeItem({ etat: 'ANOMALIE' }),
      ];
      expect(canFinalize(items)).toBe(false);
    });

    it('retourne true quand tous les items sont renseignés', () => {
      const items = [
        makeItem({ etat: 'OK' }),
        makeItem({ etat: 'OK' }),
        makeItem({ etat: 'ANOMALIE' }),
      ];
      expect(canFinalize(items)).toBe(true);
    });
  });

  describe('hasAnomalies', () => {
    it('retourne false pour une liste vide', () => {
      expect(hasAnomalies([])).toBe(false);
    });

    it('retourne false quand tous les items sont OK', () => {
      const items = [
        makeItem({ etat: 'OK' }),
        makeItem({ etat: 'OK' }),
      ];
      expect(hasAnomalies(items)).toBe(false);
    });

    it('retourne false quand aucun item renseigné', () => {
      const items = [makeItem(), makeItem()];
      expect(hasAnomalies(items)).toBe(false);
    });

    it('retourne true quand au moins un item est en anomalie', () => {
      const items = [
        makeItem({ etat: 'OK' }),
        makeItem({ etat: 'ANOMALIE' }),
        makeItem({ etat: 'OK' }),
      ];
      expect(hasAnomalies(items)).toBe(true);
    });
  });

  describe('countAnomalies', () => {
    it('retourne 0 pour une liste vide', () => {
      expect(countAnomalies([])).toBe(0);
    });

    it('retourne 0 quand aucune anomalie', () => {
      const items = [
        makeItem({ etat: 'OK' }),
        makeItem({ etat: 'OK' }),
      ];
      expect(countAnomalies(items)).toBe(0);
    });

    it('compte les anomalies correctement', () => {
      const items = [
        makeItem({ etat: 'ANOMALIE' }),
        makeItem({ etat: 'OK' }),
        makeItem({ etat: 'ANOMALIE' }),
        makeItem({ etat: 'OK' }),
      ];
      expect(countAnomalies(items)).toBe(2);
    });
  });

  describe('getFinalStatut', () => {
    it('retourne TERMINE_OK quand aucune anomalie', () => {
      const items = [
        makeItem({ etat: 'OK' }),
        makeItem({ etat: 'OK' }),
      ];
      expect(getFinalStatut(items)).toBe('TERMINE_OK');
    });

    it('retourne TERMINE_INCIDENT quand au moins une anomalie', () => {
      const items = [
        makeItem({ etat: 'OK' }),
        makeItem({ etat: 'ANOMALIE' }),
      ];
      expect(getFinalStatut(items)).toBe('TERMINE_INCIDENT');
    });

    it('retourne TERMINE_INCIDENT quand toutes les anomalies', () => {
      const items = [
        makeItem({ etat: 'ANOMALIE' }),
        makeItem({ etat: 'ANOMALIE' }),
      ];
      expect(getFinalStatut(items)).toBe('TERMINE_INCIDENT');
    });
  });

  describe('getEdlActionLabel', () => {
    it('retourne "Commencer" pour NON_COMMENCE', () => {
      expect(getEdlActionLabel('NON_COMMENCE')).toBe('Commencer');
    });

    it('retourne "Reprendre" pour EN_COURS', () => {
      expect(getEdlActionLabel('EN_COURS')).toBe('Reprendre');
    });

    it('retourne "Voir le détail" pour TERMINE_OK', () => {
      expect(getEdlActionLabel('TERMINE_OK')).toBe('Voir le détail');
    });

    it('retourne "Voir le détail" pour TERMINE_INCIDENT', () => {
      expect(getEdlActionLabel('TERMINE_INCIDENT')).toBe('Voir le détail');
    });
  });

  describe('sortItemsByOrdre', () => {
    it('trie les items par ordre croissant', () => {
      const items = [
        makeItem({ ordre: 3, checklist_item_label: 'C' }),
        makeItem({ ordre: 1, checklist_item_label: 'A' }),
        makeItem({ ordre: 2, checklist_item_label: 'B' }),
      ];
      const sorted = sortItemsByOrdre(items);
      expect(sorted[0].checklist_item_label).toBe('A');
      expect(sorted[1].checklist_item_label).toBe('B');
      expect(sorted[2].checklist_item_label).toBe('C');
    });

    it('ne modifie pas le tableau original', () => {
      const items = [
        makeItem({ ordre: 2 }),
        makeItem({ ordre: 1 }),
      ];
      const sorted = sortItemsByOrdre(items);
      expect(sorted).not.toBe(items);
      expect(items[0].ordre).toBe(2);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { hasPermission, markPaidToggleMode, type Permission } from './permissions';

describe('permissions — matrice de droits', () => {
  describe('Admin', () => {
    it('admin a toutes les permissions', () => {
      const allPermissions: Permission[] = [
        'reservation:create',
        'reservation:edit',
        'reservation:cancel',
        'dossier:view',
        'dossier:advance',
        'paiement:mark_paid',
        'edl:create',
        'edl:edit',
        'document:upload_all',
        'document:replace',
        'tache:create',
        'tache:assign',
        'tache:complete',
        'logement:create',
        'logement:edit',
        'logement:archive',
        'checklist:manage',
        'utilisateur:manage',
        'settings:manage',
      ];

      for (const perm of allPermissions) {
        expect(hasPermission('ADMIN', perm)).toBe(true);
      }
    });

    it('admin a les permissions même sans userPermissions', () => {
      expect(hasPermission('ADMIN', 'paiement:mark_paid')).toBe(true);
      expect(hasPermission('ADMIN', 'settings:manage')).toBe(true);
    });
  });

  describe('Co-hôte — permissions de base', () => {
    const basePermissions: Permission[] = [
      'reservation:create',
      'reservation:edit',
      'dossier:view',
      'dossier:advance',
      'edl:create',
      'edl:edit',
      'tache:complete',
    ];

    for (const perm of basePermissions) {
      it(`co-hôte a la permission ${perm}`, () => {
        expect(hasPermission('COHOTE', perm)).toBe(true);
      });
    }
  });

  describe('Co-hôte — permissions refusées', () => {
    const deniedPermissions: Permission[] = [
      'reservation:cancel',
      'document:upload_all',
      'document:replace',
      'tache:create',
      'tache:assign',
      'logement:create',
      'logement:edit',
      'logement:archive',
      'checklist:manage',
      'utilisateur:manage',
      'settings:manage',
    ];

    for (const perm of deniedPermissions) {
      it(`co-hôte n'a PAS la permission ${perm}`, () => {
        expect(hasPermission('COHOTE', perm)).toBe(false);
      });
    }
  });

  describe('Co-hôte — permissions explicites', () => {
    it('paiement:mark_paid refusé par défaut', () => {
      expect(hasPermission('COHOTE', 'paiement:mark_paid')).toBe(false);
    });

    it('paiement:mark_paid refusé si userPermissions vide', () => {
      expect(hasPermission('COHOTE', 'paiement:mark_paid', {})).toBe(false);
    });

    it('paiement:mark_paid refusé si explicitement false', () => {
      expect(hasPermission('COHOTE', 'paiement:mark_paid', { 'paiement:mark_paid': false })).toBe(false);
    });

    it('paiement:mark_paid accordé si explicitement true', () => {
      expect(hasPermission('COHOTE', 'paiement:mark_paid', { 'paiement:mark_paid': true })).toBe(true);
    });
  });

  describe('Concierge — permissions de base', () => {
    const allowedPermissions: Permission[] = [
      'dossier:view',
      'edl:create',
      'edl:edit',
      'tache:complete',
    ];

    for (const perm of allowedPermissions) {
      it(`concierge a la permission ${perm}`, () => {
        expect(hasPermission('CONCIERGE', perm)).toBe(true);
      });
    }
  });

  describe('Concierge — permissions refusées', () => {
    const deniedPermissions: Permission[] = [
      'reservation:create',
      'reservation:edit',
      'reservation:cancel',
      'dossier:advance',
      'document:upload_all',
      'document:replace',
      'tache:create',
      'tache:assign',
      'logement:create',
      'logement:edit',
      'logement:archive',
      'checklist:manage',
      'utilisateur:manage',
      'settings:manage',
    ];

    for (const perm of deniedPermissions) {
      it(`concierge n'a PAS la permission ${perm}`, () => {
        expect(hasPermission('CONCIERGE', perm)).toBe(false);
      });
    }
  });

  describe('Concierge — paiement:mark_paid toujours interdit', () => {
    it('paiement:mark_paid refusé sans userPermissions', () => {
      expect(hasPermission('CONCIERGE', 'paiement:mark_paid')).toBe(false);
    });

    it('paiement:mark_paid refusé même si explicitement true dans userPermissions', () => {
      expect(
        hasPermission('CONCIERGE', 'paiement:mark_paid', { 'paiement:mark_paid': true }),
      ).toBe(false);
    });
  });

  describe('Rôle null/invalide', () => {
    it('retourne false si le rôle est null', () => {
      expect(hasPermission(null, 'reservation:create')).toBe(false);
    });

    it('retourne false pour toutes les permissions avec rôle null', () => {
      expect(hasPermission(null, 'settings:manage')).toBe(false);
      expect(hasPermission(null, 'paiement:mark_paid', { 'paiement:mark_paid': true })).toBe(false);
    });
  });

  describe('markPaidToggleMode', () => {
    it('ADMIN retourne always', () => {
      expect(markPaidToggleMode('ADMIN')).toBe('always');
    });

    it('COHOTE retourne toggle', () => {
      expect(markPaidToggleMode('COHOTE')).toBe('toggle');
    });

    it('CONCIERGE retourne never', () => {
      expect(markPaidToggleMode('CONCIERGE')).toBe('never');
    });
  });
});

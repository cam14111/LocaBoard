import { describe, it, expect } from 'vitest';
import { parseRpcError } from './rpcErrors';

describe('rpcErrors — parsing erreurs RPC', () => {
  it('traduit CONFLIT_DATES en message français', () => {
    const error = { message: 'RPC error: CONFLIT_DATES' };
    expect(parseRpcError(error)).toBe('Les dates sont en conflit avec une réservation existante.');
  });

  it('traduit CONFLIT_BLOCAGE en message français', () => {
    const error = { message: 'CONFLIT_BLOCAGE' };
    expect(parseRpcError(error)).toBe('Le créneau est bloqué pour cette période.');
  });

  it('traduit TAMPON_MENAGE en message français', () => {
    const error = { message: 'Error: TAMPON_MENAGE not enough' };
    expect(parseRpcError(error)).toBe('Tampon ménage insuffisant entre les séjours.');
  });

  it('retourne le message original pour une erreur inconnue', () => {
    const error = { message: 'Something else went wrong' };
    expect(parseRpcError(error)).toBe('Something else went wrong');
  });

  it('retourne message par défaut si erreur est null', () => {
    expect(parseRpcError(null)).toBe('Une erreur inattendue est survenue.');
  });

  it('retourne message par défaut si erreur est undefined', () => {
    expect(parseRpcError(undefined)).toBe('Une erreur inattendue est survenue.');
  });

  it('retourne message par défaut si erreur n\'est pas un objet', () => {
    expect(parseRpcError('string error')).toBe('Une erreur inattendue est survenue.');
  });

  it('retourne message par défaut si message est vide', () => {
    const error = { message: '' };
    expect(parseRpcError(error)).toBe('Une erreur inattendue est survenue.');
  });

  it('retourne message par défaut si pas de propriété message', () => {
    const error = { code: 42 };
    expect(parseRpcError(error)).toBe('Une erreur inattendue est survenue.');
  });
});

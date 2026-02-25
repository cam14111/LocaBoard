import { describe, it, expect } from 'vitest';
import { parsePhotoUrls } from './api/edl';

describe('parsePhotoUrls', () => {
  it('retourne un tableau vide pour null', () => {
    expect(parsePhotoUrls(null)).toEqual([]);
  });

  it('retourne un tableau vide pour chaîne vide', () => {
    expect(parsePhotoUrls('')).toEqual([]);
  });

  it('parse un JSON array valide', () => {
    const json = JSON.stringify(['path/a.jpg', 'path/b.jpg']);
    expect(parsePhotoUrls(json)).toEqual(['path/a.jpg', 'path/b.jpg']);
  });

  it('gère un JSON array vide', () => {
    expect(parsePhotoUrls('[]')).toEqual([]);
  });

  it('wrappe une URL simple en tableau', () => {
    expect(parsePhotoUrls('path/photo.jpg')).toEqual(['path/photo.jpg']);
  });

  it('wrappe une URL simple (JSON invalide) en tableau', () => {
    expect(parsePhotoUrls('https://example.com/photo.jpg')).toEqual([
      'https://example.com/photo.jpg',
    ]);
  });

  it('gère un JSON non-array (string) en le wrappant', () => {
    expect(parsePhotoUrls('"single-path.jpg"')).toEqual(['"single-path.jpg"']);
  });
});

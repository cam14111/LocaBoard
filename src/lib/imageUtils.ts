/**
 * Utilitaires image : compression + suppression EXIF
 * Le passage par canvas supprime automatiquement les métadonnées EXIF (GPS, etc.)
 */

const MAX_DIMENSION = 1920;

/** Compresse une image et supprime les métadonnées EXIF via re-encodage canvas */
export async function compressAndStripExif(
  file: File,
  maxSizeMB = 2,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Redimensionner si trop grand
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      const maxBytes = maxSizeMB * 1024 * 1024;
      let quality = 0.85;

      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Compression failed'));
              return;
            }

            if (blob.size <= maxBytes || quality <= 0.3) {
              // Nom avec extension .jpg
              const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
              resolve(new File([blob], name, { type: 'image/jpeg' }));
            } else {
              quality -= 0.1;
              tryCompress();
            }
          },
          'image/jpeg',
          quality,
        );
      };

      tryCompress();
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

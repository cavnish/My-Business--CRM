const MAX_SOURCE_SIZE = 8 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = 500_000;
const MAX_DIMENSION = 512;

const loadImage = (source) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Could not read the selected image.'));
  image.src = source;
});

export async function profileImageDataUrl(file) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Choose an image file.');
  }
  if (file.size > MAX_SOURCE_SIZE) {
    throw new Error('Choose an image smaller than 8 MB.');
  }

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(sourceUrl);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser cannot process this image.');

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.7, 0.58, 0.45]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= MAX_DATA_URL_LENGTH) return dataUrl;
    }
    throw new Error('This image is too large to save as a profile picture. Choose a smaller image.');
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

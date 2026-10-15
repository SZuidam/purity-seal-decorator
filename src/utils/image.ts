const MAX_IMAGE_PX = 2400;

export interface LoadedImage {
  dataUrl: string;
  width: number;
  height: number;
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function decode(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read the image.'));
    img.src = src;
  });
}

/** Read an image file as a data URL, downscaling very large images to keep documents small. */
export async function loadImageFile(file: Blob): Promise<LoadedImage> {
  const dataUrl = await readAsDataUrl(file);
  const img = await decode(dataUrl);
  const { naturalWidth: w, naturalHeight: h } = img;
  const longest = Math.max(w, h);
  if (longest <= MAX_IMAGE_PX || file.type === 'image/svg+xml') {
    return { dataUrl, width: w || 100, height: h || 100 };
  }
  const scale = MAX_IMAGE_PX / longest;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  return { dataUrl: canvas.toDataURL(type, 0.92), width: canvas.width, height: canvas.height };
}

export function firstImageFile(list: DataTransferItemList | FileList | null | undefined): File | null {
  if (!list) return null;
  for (const item of Array.from(list as ArrayLike<DataTransferItem | File>)) {
    const file = item instanceof File ? item : item.kind === 'file' ? item.getAsFile() : null;
    if (file && file.type.startsWith('image/')) return file;
  }
  return null;
}

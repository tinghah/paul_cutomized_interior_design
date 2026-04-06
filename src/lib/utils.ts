export function resizeAndConvertImage(blob: Blob, maxWidth = 1024, maxHeight = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Failed to get canvas context'));
      }
      ctx.drawImage(img, 0, 0, width, height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for resizing'));
    };
    
    img.src = url;
  });
}

export async function fileToBase64(file: File): Promise<string> {
  return resizeAndConvertImage(file);
}

export async function urlToBase64(url: string): Promise<{base64: string, mimeType: string}> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const base64 = await resizeAndConvertImage(blob);
    return { mimeType: 'image/jpeg', base64 };
  } catch (error) {
    console.error("Error fetching image from URL:", error);
    throw new Error("Failed to load template image. It might be blocked by CORS.");
  }
}

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}



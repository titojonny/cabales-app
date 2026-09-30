/** Lee el nombre entregado por la API sin aceptar rutas ni caracteres de control. */
export function filenameFromContentDisposition(value: string | null, fallback: string): string {
  if (!value) return fallback;
  const encoded = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const quoted = value.match(/filename="([^"]+)"/i)?.[1];
  const plain = value.match(/filename=([^;]+)/i)?.[1]?.trim();
  let filename = fallback;
  try {
    filename = encoded ? decodeURIComponent(encoded) : quoted ?? plain ?? fallback;
  } catch {
    filename = quoted ?? plain ?? fallback;
  }
  const safe = filename.replace(/[\\/\u0000-\u001f\u007f]/g, '_').trim();
  return safe || fallback;
}

export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

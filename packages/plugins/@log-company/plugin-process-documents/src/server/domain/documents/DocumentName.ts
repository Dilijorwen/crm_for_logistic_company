function hasMojibake(value: string): boolean {
  return /[ÃÂÐÑâ][\u0080-\u00ff]/.test(value);
}

export function decodeUploadedName(rawName: string): string {
  const value = String(rawName || '');
  if (!value || !hasMojibake(value)) {
    return value;
  }

  const decoded = Buffer.from(value, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? value : decoded;
}

export function sanitizeDocumentName(value: string): string {
  return (
    String(value || 'file')
      .replace(/[\\/\0]/g, '_')
      .trim() || 'file'
  );
}

function splitFileName(filename: string): { base: string; extension: string } {
  const clean = sanitizeDocumentName(filename);
  const extensionIndex = clean.lastIndexOf('.');
  const hasExtension = extensionIndex > 0;
  return {
    base: hasExtension ? clean.slice(0, extensionIndex) : clean,
    extension: hasExtension ? clean.slice(extensionIndex) : '',
  };
}

export function splitRelativeDocumentName(rawName: string): { folders: string[]; filename: string } {
  const parts = decodeUploadedName(rawName)
    .split(/[\\/]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return { folders: [], filename: 'file' };
  }

  return {
    folders: parts.slice(0, -1),
    filename: parts[parts.length - 1],
  };
}

export function safeStorageExtension(filename: string): string {
  const { extension } = splitFileName(filename);
  const safeExtension = extension
    .replace(/^\./, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 16);
  return safeExtension ? `.${safeExtension.toLowerCase()}` : '';
}

export function createUniqueDocumentName(requested: string, existingNames: Iterable<string>, isFile: boolean): string {
  const existing = new Set(existingNames);
  const clean = sanitizeDocumentName(requested);
  if (!existing.has(clean)) {
    return clean;
  }

  const { base, extension } = splitFileName(clean);
  let index = 1;
  while (existing.has(isFile ? `${base} (${index})${extension}` : `${base} (${index})`)) {
    index += 1;
  }
  return isFile ? `${base} (${index})${extension}` : `${base} (${index})`;
}

import path from 'path';

export class PathValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathValidationError';
  }
}

const DEFAULT_ALLOWED_EXTENSION = '.log';

const toAllowListSet = (allowList?: Iterable<string>): Set<string> | null => {
  if (!allowList) {
    return null;
  }

  if (allowList instanceof Set) {
    return allowList;
  }

  return new Set(Array.from(allowList));
};

export const validateLogPath = (
  baseDir: string,
  filename: string,
  allowList?: Iterable<string>
): string => {
  if (!filename) {
    throw new PathValidationError('Log filename is required');
  }

  if (filename.includes('\0')) {
    throw new PathValidationError('Log filename contains invalid characters');
  }

  const normalizedBase = path.resolve(baseDir);
  const normalizedPath = path.resolve(normalizedBase, filename);

  if (!normalizedPath.startsWith(normalizedBase + path.sep) && normalizedPath !== normalizedBase) {
    throw new PathValidationError('Log filename resolves outside the logs directory');
  }

  if (!normalizedPath.endsWith(DEFAULT_ALLOWED_EXTENSION)) {
    throw new PathValidationError('Unsupported log file extension');
  }

  const allowedSet = toAllowListSet(allowList);
  if (allowedSet && !allowedSet.has(path.basename(normalizedPath))) {
    throw new PathValidationError('Log file is not on the allow list');
  }

  return normalizedPath;
};

export const getAllowedLogFiles = async (baseDir: string): Promise<string[]> => {
  try {
    const fs = await import('fs/promises');
    const files = await fs.readdir(baseDir);
    
    // Only return .log files to prevent directory traversal
    return files.filter(file => 
      file.endsWith(DEFAULT_ALLOWED_EXTENSION) && 
      !file.includes('..') && 
      !file.includes('/') && 
      !file.includes('\\')
    );
  } catch (error) {
    throw new PathValidationError(`Failed to list log files: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

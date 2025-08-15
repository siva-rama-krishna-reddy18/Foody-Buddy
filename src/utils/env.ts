// src/utils/env.ts
export function getEnvVar(key: string, defaultValue = ''): string {
  // Only check import.meta if running in a browser-like Vite context
  try {
    // @ts-ignore - This will not exist in Jest/Node
    if (typeof window !== 'undefined' && typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env[key] ?? defaultValue;
    }
  } catch {
    // Ignore if import.meta is not available
  }

  // Fallback to Node/Jest environment
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] ?? defaultValue;
  }

  return defaultValue;
}
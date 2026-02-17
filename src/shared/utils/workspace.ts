import { existsSync } from 'node:fs';
import * as path from 'node:path';

export const WORKSPACE_DIRNAME = '.clawtutor';
export const LEGACY_WORKSPACE_DIRNAME = '.codemachine';

/**
 * Resolve the project workspace root.
 * Preference order:
 * 1) `.clawtutor` if present
 * 2) `.codemachine` if present (legacy compatibility)
 * 3) `.clawtutor` as the default target for new workspaces
 */
export function resolveWorkspaceRoot(cwd: string): string {
  const clawtutorRoot = path.join(cwd, WORKSPACE_DIRNAME);
  const legacyRoot = path.join(cwd, LEGACY_WORKSPACE_DIRNAME);

  if (existsSync(clawtutorRoot)) {
    return clawtutorRoot;
  }

  if (existsSync(legacyRoot)) {
    return legacyRoot;
  }

  return clawtutorRoot;
}

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getAllInstalledImports } from '../../imports/index.js';
import { LEGACY_WORKSPACE_DIRNAME, WORKSPACE_DIRNAME } from '../../utils/index.js';

const AGENT_MODULE_FILENAMES = ['sub.agents.js', 'main.agents.js', 'modules.js', 'agents.js'];
const AGENT_JSON_RELATIVE_PATHS = [
  join(WORKSPACE_DIRNAME, 'agents', 'agents-config.json'),
  join(LEGACY_WORKSPACE_DIRNAME, 'agents', 'agents-config.json'),
];

export type AgentsModuleLookupOptions = {
  projectRoot?: string;
  /** Whether to also check imported packages */
  checkImports?: boolean;
};

export function resolveAgentsModulePath(options: AgentsModuleLookupOptions = {}): string | undefined {
  const projectRoot = options.projectRoot ? resolve(options.projectRoot) : undefined;
  const checkImports = options.checkImports ?? true;

  const candidates: string[] = [];

  // Check imported packages first (they take precedence)
  if (checkImports) {
    const imports = getAllInstalledImports();
    for (const imp of imports) {
      for (const filename of AGENT_MODULE_FILENAMES) {
        candidates.push(join(imp.resolvedPaths.config, filename));
      }
    }
  }

  // Then check project root
  if (projectRoot) {
    for (const relPath of AGENT_JSON_RELATIVE_PATHS) {
      candidates.push(join(projectRoot, relPath));
    }

    for (const filename of AGENT_MODULE_FILENAMES) {
      candidates.push(join(projectRoot, 'config', filename));
      candidates.push(join(projectRoot, 'dist', 'config', filename));
    }
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

/**
 * Get all agent module paths including from imports
 * Returns an array of all existing agent config paths
 */
export function getAllAgentsModulePaths(projectRoot?: string): string[] {
  const paths: string[] = [];
  const resolvedRoot = projectRoot ? resolve(projectRoot) : undefined;

  // Check imported packages first
  const imports = getAllInstalledImports();
  for (const imp of imports) {
    for (const filename of AGENT_MODULE_FILENAMES) {
      const candidate = join(imp.resolvedPaths.config, filename);
      if (existsSync(candidate)) {
        paths.push(candidate);
      }
    }
  }

  // Then check project root
  if (resolvedRoot) {
    for (const relPath of AGENT_JSON_RELATIVE_PATHS) {
      const jsonPath = join(resolvedRoot, relPath);
      if (existsSync(jsonPath)) {
        paths.push(jsonPath);
      }
    }

    for (const filename of AGENT_MODULE_FILENAMES) {
      const configPath = join(resolvedRoot, 'config', filename);
      if (existsSync(configPath)) {
        paths.push(configPath);
      }
      const distPath = join(resolvedRoot, 'dist', 'config', filename);
      if (existsSync(distPath)) {
        paths.push(distPath);
      }
    }
  }

  return paths;
}

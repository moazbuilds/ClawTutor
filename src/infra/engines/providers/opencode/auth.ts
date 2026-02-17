import { stat, rm, writeFile, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';

import { expandHomeDir } from '../../../../shared/utils/index.js';
import {
  displayCliNotInstalledError,
  isCommandNotFoundError,
  ensureAuthDirectory,
} from '../../core/auth.js';
import { metadata } from './metadata.js';
import { ENV } from './config.js';

/**
 * Resolves CLAWTUTOR_OPENCODE_HOME override.
 * Returns undefined when not configured so callers can use native XDG defaults.
 */
function resolveOpenCodeHome(customPath?: string): string | undefined {
  const configured = customPath ?? process.env[ENV.OPENCODE_HOME];
  return configured ? expandHomeDir(configured) : undefined;
}

/**
 * Check if CLI binary exists in PATH (instant, no subprocess)
 * OpenCode works with zero config - just needs to be installed
 */
function isCliInstalled(command: string): boolean {
  return Bun.which(command) !== null;
}

export async function isAuthenticated(): Promise<boolean> {
  // OpenCode works with zero config - just needs to be installed
  // No auth check required; users can optionally login for specific APIs
  return isCliInstalled(metadata.cliBinary);
}

/**
 * Resolves OpenCode's actual data directory (where OpenCode stores auth.json)
 * This uses XDG_DATA_HOME if set, otherwise falls back to standard XDG path
 */
function resolveOpenCodeDataDir(): string {
  const opencodeHome = resolveOpenCodeHome();
  if (opencodeHome) {
    return path.join(opencodeHome, 'data');
  }

  const xdgData = process.env.XDG_DATA_HOME
    ? expandHomeDir(process.env.XDG_DATA_HOME)
    : path.join(homedir(), '.local', 'share');
  return path.join(xdgData, 'opencode');
}

function resolveOpenCodeConfigDir(): string {
  const opencodeHome = resolveOpenCodeHome();
  if (opencodeHome) {
    return path.join(opencodeHome, 'config');
  }

  const xdgConfig = process.env.XDG_CONFIG_HOME
    ? expandHomeDir(process.env.XDG_CONFIG_HOME)
    : path.join(homedir(), '.config');
  return path.join(xdgConfig, 'opencode');
}

function resolveOpenCodeCacheDir(): string {
  const opencodeHome = resolveOpenCodeHome();
  if (opencodeHome) {
    return path.join(opencodeHome, 'cache');
  }

  const xdgCache = process.env.XDG_CACHE_HOME
    ? expandHomeDir(process.env.XDG_CACHE_HOME)
    : path.join(homedir(), '.cache');
  return path.join(xdgCache, 'opencode');
}

async function hasOpenCodeCredential(providerId: string = 'opencode'): Promise<boolean> {
  const authPath = path.join(resolveOpenCodeDataDir(), 'auth.json');
  try {
    const raw = await readFile(authPath, 'utf8');
    const json = JSON.parse(raw);
    return !!json && typeof json === 'object' && providerId in json;
  } catch {
    return false;
  }
}

export async function ensureAuth(forceLogin = false): Promise<boolean> {
  const dataDir = resolveOpenCodeDataDir();

  // Check if already authenticated (skip if forceLogin is true)
  if (!forceLogin && await hasOpenCodeCredential('opencode')) {
    return true;
  }

  // Ensure data directory exists before proceeding
  await ensureAuthDirectory(dataDir);

  // Check if CLI is installed
  if (!isCliInstalled(metadata.cliBinary)) {
    displayCliNotInstalledError(metadata);
    throw new Error(`${metadata.name} CLI is not installed.`);
  }

  // Only force XDG paths when CLAWTUTOR_OPENCODE_HOME override is configured.
  const xdgEnv = { ...process.env };
  const opencodeHome = resolveOpenCodeHome();
  if (opencodeHome) {
    xdgEnv.XDG_CONFIG_HOME = path.join(opencodeHome, 'config');
    xdgEnv.XDG_CACHE_HOME = path.join(opencodeHome, 'cache');
    xdgEnv.XDG_DATA_HOME = path.join(opencodeHome, 'data');
  }

  // Run interactive login via OpenCode CLI
  try {
    // Resolve opencode command to handle Windows .cmd files
    const resolvedOpenCode = Bun.which('opencode') ?? 'opencode';

    const proc = Bun.spawn([resolvedOpenCode, 'auth', 'login'], {
      env: xdgEnv,
      stdio: ['inherit', 'inherit', 'inherit'],
    });
    await proc.exited;
  } catch (error) {
    if (isCommandNotFoundError(error)) {
      console.error(`\n────────────────────────────────────────────────────────────`);
      console.error(`  ⚠️  ${metadata.name} CLI Not Found`);
      console.error(`────────────────────────────────────────────────────────────`);
      console.error(`\n'${metadata.cliBinary} auth login' failed because the CLI is missing.`);
      console.error(`Please install ${metadata.name} CLI before trying again:\n`);
      console.error(`  ${metadata.installCommand}\n`);
      console.error(`────────────────────────────────────────────────────────────\n`);
      throw new Error(`${metadata.name} CLI is not installed.`);
    }

    throw error;
  }

  // Ensure auth file exists (some providers may not be added until first use).
  const authPath = path.join(resolveOpenCodeDataDir(), 'auth.json');
  try {
    await stat(authPath);
  } catch {
    await writeFile(authPath, '{}', 'utf8');
  }

  return true;
}

export async function clearAuth(): Promise<void> {
  const opencodeHome = resolveOpenCodeHome();
  const targets = opencodeHome
    ? [opencodeHome]
    : [resolveOpenCodeConfigDir(), resolveOpenCodeCacheDir(), resolveOpenCodeDataDir()];

  for (const target of targets) {
    try {
      await rm(target, { recursive: true, force: true });
    } catch {
      // Ignore removal errors
    }
  }

  console.log(`\n${metadata.name} authentication cleared.`);
  if (opencodeHome) {
    console.log(`Removed OpenCode home directory at ${opencodeHome} (if it existed).\n`);
  } else {
    console.log(`Removed OpenCode XDG directories (if they existed).\n`);
  }
}

export async function nextAuthMenuAction(): Promise<'login' | 'logout'> {
  // If CLI is missing → login
  const cli = await isAuthenticated();
  if (!cli) return 'login';

  // If membership credential not found → show login guidance
  const hasMembership = await hasOpenCodeCredential('opencode');
  return hasMembership ? 'logout' : 'login';
}

export { resolveOpenCodeHome, resolveOpenCodeConfigDir };

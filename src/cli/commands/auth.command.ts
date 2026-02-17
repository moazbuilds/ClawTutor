import type { Command } from 'commander';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { confirm, isCancel } from '@clack/prompts';
import { registry } from '../../infra/engines/index.js';
import { selectFromMenu, type SelectionChoice } from '../utils/selection-menu.js';
import { expandHomeDir } from '../../shared/utils/index.js';

interface AuthProviderChoice extends SelectionChoice<string> {
  title: string;
  value: string;
  description?: string;
}

export async function selectAuthProvider(): Promise<string | undefined> {
  const choices: AuthProviderChoice[] = registry.getAll().map(engine => ({
    title: engine.metadata.name,
    value: engine.metadata.id,
    description: engine.metadata.description
  }));

  return await selectFromMenu({
    message: 'Choose authentication provider:',
    choices,
    initial: 0
  });
}

export async function handleLogin(providerId: string): Promise<void> {
  const engine = registry.get(providerId);
  if (!engine) {
    throw new Error(`Unknown provider: ${providerId}`);
  }

  const action = await engine.auth.nextAuthMenuAction();
  if (action === 'logout') {
    // Special handling for OpenCode - supports multiple auth providers
    if (providerId === 'opencode') {
      console.log(`\n────────────────────────────────────────────────────────────`);
      console.log(`  ✅  ${engine.metadata.name} Already Authenticated`);
      console.log(`────────────────────────────────────────────────────────────\n`);

      // Build XDG environment variables pointing to OPENCODE_HOME
      const opencodeHome = process.env.OPENCODE_HOME
        ? expandHomeDir(process.env.OPENCODE_HOME)
        : path.join(homedir(), '.clawtutor', 'opencode');

      const xdgEnv = {
        ...process.env,
        XDG_CONFIG_HOME: path.join(opencodeHome, 'config'),
        XDG_CACHE_HOME: path.join(opencodeHome, 'cache'),
        XDG_DATA_HOME: path.join(opencodeHome, 'data'),
      };

      // Show current auth providers
      console.log(`Current authentication providers:\n`);
      try {
        const proc = Bun.spawn(['opencode', 'auth', 'list'], {
          stdout: 'inherit',
          stderr: 'inherit',
          stdin: 'inherit',
          env: { ...process.env, ...xdgEnv }
        });
        await proc.exited;
      } catch {
        console.log('(Unable to fetch auth list)');
      }

      console.log();

      // Ask if user wants to add another provider
      const addAnother = await confirm({
        message: 'Do you want to add another authentication provider?',
        initialValue: false,
      });

      if (isCancel(addAnother)) {
        console.log('\nAuthentication update cancelled.\n');
        return;
      }

      if (addAnother) {
        // Force login to add another provider
        await engine.auth.ensureAuth(true);
        console.log(`\n${engine.metadata.name} authentication provider added successfully.`);
      } else {
        console.log(`\nTo sign out and clear all data: clawtutor auth logout`);
        console.log(`────────────────────────────────────────────────────────────\n`);
      }
    } else {
      console.log(`Already authenticated with ${engine.metadata.name}. Use \`clawtutor auth logout\` to sign out.`);
    }
    return;
  }

  await engine.auth.ensureAuth();
  console.log(`${engine.metadata.name} authentication successful.`);
}

export async function handleLogout(providerId: string): Promise<void> {
  const engine = registry.get(providerId);
  if (!engine) {
    throw new Error(`Unknown provider: ${providerId}`);
  }

  await engine.auth.clearAuth();
  console.log(`Signed out from ${engine.metadata.name}. Next action will be \`login\`.`);
}

export function registerAuthCommands(program: Command): void {
  const authCommand = program
    .command('auth')
    .description('Authentication helpers');

  authCommand
    .command('login')
    .description('Authenticate with Clawtutor services')
    .action(async () => {
      const provider = await selectAuthProvider();
      if (!provider) {
        console.log('No provider selected.');
        return;
      }
      await handleLogin(provider);
    });

  authCommand
    .command('logout')
    .description('Log out of Clawtutor services')
    .action(async () => {
      const provider = await selectAuthProvider();
      if (!provider) {
        console.log('No provider selected.');
        return;
      }
      await handleLogout(provider);
    });
}

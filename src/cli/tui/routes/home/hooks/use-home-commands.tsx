/** @jsxImportSource @opentui/solid */
/**
 * Home Commands Hook
 *
 * Handles command execution logic for the home view.
 */

import { useRenderer } from "@opentui/solid"
import { useToast } from "@tui/shared/context/toast"
import { HOME_COMMANDS } from "../config/commands"

export interface UseHomeCommandsOptions {
  onStartWorkflow?: () => void
}

export function useHomeCommands(options: UseHomeCommandsOptions) {
  const toast = useToast()
  const renderer = useRenderer()

  const handleCommand = async (command: string) => {
    const cmd = command.toLowerCase()
    console.log(`Executing command: ${cmd}`)

    if (cmd === HOME_COMMANDS.START) {
      await handleStartCommand()
      return
    }

    if (cmd === HOME_COMMANDS.EXIT || cmd === HOME_COMMANDS.QUIT) {
      handleExitCommand()
      return
    }

    toast.show({
      variant: "error",
      message: `Unknown command: ${command}. Available commands: /start, /exit`,
    })
  }

  const handleStartCommand = async () => {
    try {
      // Pre-flight check - validates specification if required by template
      const { checkSpecificationRequired } = await import("../../../../../workflows/preflight.js")
      await checkSpecificationRequired()
    } catch (error) {
      if (error instanceof Error) {
        toast.show({
          variant: "info",
          message: error.message,
          duration: 10000,
        })
      }
      return
    }

    if (options.onStartWorkflow) {
      options.onStartWorkflow()
    }
  }

  const handleExitCommand = () => {
    renderer.destroy()

    if (process.stdout.isTTY) {
      process.stdout.write('\x1b[2J\x1b[H\x1b[?25h')
    }

    process.exit(0)
  }

  return { handleCommand }
}

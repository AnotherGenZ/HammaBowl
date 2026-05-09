import { definePlugin } from 'nitro'
import {
  missingDiscordSlashCommandRegistrationEnv,
  registerDiscordSlashCommandsOnce,
} from '../lib/discordCommandRegistration.server'

export default definePlugin((nitroApp) => {
  const missingEnv = missingDiscordSlashCommandRegistrationEnv()
  if (missingEnv.length) {
    console.warn(`Skipping Discord slash command registration. Missing: ${missingEnv.join(', ')}.`)
    return
  }

  void registerDiscordSlashCommandsOnce()
    .then(({ commandNames, guildId }) => {
      const registeredCommands = commandNames.map((name) => `/${name}`).join(', ')
      console.log(`Registered Discord slash commands in guild ${guildId}: ${registeredCommands}.`)
    })
    .catch((error) => {
      nitroApp.captureError?.(error instanceof Error ? error : new Error(String(error)), {
        tags: ['startup', 'discord-commands'],
      })
      console.error('Failed to register Discord slash commands.', error)
    })
})

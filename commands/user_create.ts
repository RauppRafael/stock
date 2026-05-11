import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { flags } from '@adonisjs/core/ace'

export default class UserCreate extends BaseCommand {
  static commandName = 'user:create'
  static description = 'Create a new user account from the command line'

  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Email address for the new user' })
  declare email?: string

  @flags.string({ description: 'Full name for the new user' })
  declare fullName?: string

  @flags.string({ description: 'Password (min 8 chars). Will prompt securely if omitted.' })
  declare password?: string

  async run() {
    const { default: User } = await import('#models/user')
    const { createUserValidator } = await import('#validators/user')

    const fullName = this.fullName ?? (await this.prompt.ask('Full name', { validate: req }))
    const email = this.email ?? (await this.prompt.ask('Email', { validate: req }))
    const password =
      this.password ??
      (await this.prompt.secure('Password (min 8 chars)', {
        validate: (value) => (value && value.length >= 8) || 'Must be at least 8 characters',
      }))

    try {
      const payload = await createUserValidator.validate({ fullName, email, password })
      const user = await User.create(payload)
      this.logger.success(`User #${user.id} <${user.email}> created`)
    } catch (error) {
      this.printValidationError(error)
      this.exitCode = 1
    }
  }

  private printValidationError(error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'messages' in error &&
      Array.isArray(error.messages)
    ) {
      for (const m of error.messages) {
        this.logger.error(`${m.field}: ${m.message}`)
      }
      return
    }
    this.logger.error(error instanceof Error ? error.message : String(error))
  }
}

function req(value: string): true | string {
  return value.trim().length > 0 || 'Required'
}

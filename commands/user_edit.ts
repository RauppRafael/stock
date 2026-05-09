import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { args, flags } from '@adonisjs/core/ace'

export default class UserEdit extends BaseCommand {
  static commandName = 'user:edit'
  static description = 'Update an existing user (name, email, or password)'

  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Email of the user to edit (or numeric user id)' })
  declare identifier: string

  @flags.string({ description: 'New full name' })
  declare fullName?: string

  @flags.string({ description: 'New email address' })
  declare email?: string

  @flags.string({ description: 'New password (min 8 chars). Use --reset-password for an interactive prompt.' })
  declare password?: string

  @flags.boolean({ description: 'Prompt securely for a new password' })
  declare resetPassword: boolean

  async run() {
    const { default: User } = await import('#models/user')
    const { updateUserValidator } = await import('#validators/user')

    const user = await this.findUser(User)
    if (!user) {
      this.logger.error(`No user matched "${this.identifier}"`)
      this.exitCode = 1
      return
    }

    this.logger.info(`Editing user #${user.id} <${user.email}>${user.fullName ? ` — ${user.fullName}` : ''}`)

    let nextPassword = this.password
    if (this.resetPassword && !nextPassword) {
      nextPassword = await this.prompt.secure('New password (min 8 chars)', {
        validate: (value) => (value && value.length >= 8) || 'Must be at least 8 characters',
      })
    }

    const payload: { fullName?: string; email?: string; password?: string } = {}
    if (this.fullName !== undefined) payload.fullName = this.fullName
    if (this.email !== undefined) payload.email = this.email
    if (nextPassword !== undefined) payload.password = nextPassword

    if (Object.keys(payload).length === 0) {
      // No flags supplied — go interactive on the three editable fields.
      payload.fullName = await this.prompt.ask('Full name', { default: user.fullName ?? '' })
      payload.email = await this.prompt.ask('Email', { default: user.email })
      const change = await this.prompt.confirm('Change password?')
      if (change) {
        payload.password = await this.prompt.secure('New password (min 8 chars)', {
          validate: (value) => (value && value.length >= 8) || 'Must be at least 8 characters',
        })
      }
    }

    try {
      const validated = await updateUserValidator.validate(payload, { meta: { id: user.id } })
      user.merge(validated)
      await user.save()
      this.logger.success(`User #${user.id} updated`)
    } catch (error) {
      this.printValidationError(error)
      this.exitCode = 1
    }
  }

  private async findUser(User: typeof import('#models/user').default) {
    const asNumber = Number(this.identifier)
    if (!Number.isNaN(asNumber) && Number.isInteger(asNumber)) {
      const byId = await User.find(asNumber)
      if (byId) return byId
    }
    return User.findBy('email', this.identifier)
  }

  private printValidationError(error: unknown) {
    if (error && typeof error === 'object' && 'messages' in error && Array.isArray(error.messages)) {
      for (const m of error.messages) {
        this.logger.error(`${m.field}: ${m.message}`)
      }
      return
    }
    this.logger.error(error instanceof Error ? error.message : String(error))
  }
}

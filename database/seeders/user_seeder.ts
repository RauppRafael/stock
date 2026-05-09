import { BaseSeeder } from '@adonisjs/lucid/seeders'
import env from '#start/env'
import User from '#models/user'

const DEFAULTS = {
  email: 'admin@stock.local',
  password: 'changeme123',
  fullName: 'Admin',
}

export default class extends BaseSeeder {
  async run() {
    const email = env.get('SEED_USER_EMAIL', DEFAULTS.email)
    const password = env.get('SEED_USER_PASSWORD', DEFAULTS.password)
    const fullName = env.get('SEED_USER_NAME', DEFAULTS.fullName)

    await User.updateOrCreate({ email }, { email, password, fullName })
  }
}

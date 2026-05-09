import { DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import type { NormalizeConstructor } from '@adonisjs/core/types/helpers'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

export function withSoftDelete<Model extends NormalizeConstructor<LucidModel>>(superclass: Model) {
  class WithSoftDeleteModel extends superclass {
    @column.dateTime()
    declare deletedAt: DateTime | null

    /**
     * Query scope: exclude trashed rows.
     */
    static notTrashed<This extends typeof WithSoftDeleteModel>(
      this: This
    ): ModelQueryBuilderContract<This, InstanceType<This>> {
      return this.query().whereNull('deleted_at')
    }

    /**
     * Query scope: only trashed rows.
     */
    static onlyTrashed<This extends typeof WithSoftDeleteModel>(
      this: This
    ): ModelQueryBuilderContract<This, InstanceType<This>> {
      return this.query().whereNotNull('deleted_at')
    }

    get trashed(): boolean {
      return this.deletedAt !== null
    }

    async trash(this: WithSoftDeleteModel) {
      this.deletedAt = DateTime.now()
      await this.save()
    }

    async restore(this: WithSoftDeleteModel) {
      this.deletedAt = null
      await this.save()
    }
  }

  return WithSoftDeleteModel
}

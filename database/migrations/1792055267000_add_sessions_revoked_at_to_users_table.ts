import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Date à laquelle un administrateur a déconnecté l'utilisateur : les sessions
 * ouvertes avant cette date ne sont plus valables
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('sessions_revoked_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('sessions_revoked_at')
    })
  }
}

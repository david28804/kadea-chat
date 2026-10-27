import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Date de la dernière modification d'un message (vide s'il n'a jamais été modifié)
 */
export default class extends BaseSchema {
  protected tableName = 'messages'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('edited_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('edited_at')
    })
  }
}

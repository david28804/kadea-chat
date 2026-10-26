import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * La table message_reads n'a jamais servi : les statuts envoyé / reçu / lu
 * sont calculés à partir de conversation_members.last_read_at.
 */
export default class extends BaseSchema {
  protected tableName = 'message_reads'

  async up() {
    this.schema.dropTableIfExists(this.tableName)
  }

  async down() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('message_id').unsigned().notNullable()
        .references('id').inTable('messages').onDelete('CASCADE')
      table.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE')
      table.timestamp('delivered_at', { useTz: true }).nullable()
      table.timestamp('read_at', { useTz: true }).nullable()

      table.unique(['message_id', 'user_id'])
    })
  }
}

import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'message_reads'

  async up() {
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

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
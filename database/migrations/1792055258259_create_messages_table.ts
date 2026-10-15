import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'messages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('conversation_id').unsigned().notNullable()
        .references('id').inTable('conversations').onDelete('CASCADE')
      table.integer('sender_id').unsigned().nullable()
        .references('id').inTable('users').onDelete('SET NULL')
      table.text('content').nullable()
      table.timestamp('deleted_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()

      table.index(['conversation_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'conversation_members'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('conversation_id').unsigned().notNullable()
        .references('id').inTable('conversations').onDelete('CASCADE')
      table.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE')
      table.string('role', 20).notNullable().defaultTo('member')
      table.timestamp('joined_at', { useTz: true }).notNullable()
      table.timestamp('last_read_at', { useTz: true }).nullable()

      table.unique(['conversation_id', 'user_id'])
      table.index('user_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
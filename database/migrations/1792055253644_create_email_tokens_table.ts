import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'email_tokens'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE')
      table.string('type', 20).notNullable()
      table.string('token_hash').notNullable().unique()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('used_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()

      table.index(['user_id', 'type'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'blocked_users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('blocker_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE')
      table.integer('blocked_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE')
      table.timestamp('created_at', { useTz: true }).notNullable()

      table.unique(['blocker_id', 'blocked_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
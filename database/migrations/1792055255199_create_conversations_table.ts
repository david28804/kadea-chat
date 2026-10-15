import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'conversations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('type', 20).notNullable().defaultTo('private')
      table.string('name').nullable()
      table.string('direct_key').nullable().unique()
      table.integer('created_by').unsigned().nullable()
        .references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Photos de profil gardées dans la base : le disque de l'hébergeur
 * est effacé à chaque redémarrage, la base de données non
 */
export default class extends BaseSchema {
  protected tableName = 'user_avatars'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.integer('user_id').unsigned().primary()
        .references('id').inTable('users').onDelete('CASCADE')
      table.binary('data').notNullable()
      table.string('mime_type', 50).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    // Les anciennes photos sur le disque sont perdues : on les oublie
    this.defer(async (db) => {
      await db.from('users').whereNotNull('avatar').update({ avatar: null })
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

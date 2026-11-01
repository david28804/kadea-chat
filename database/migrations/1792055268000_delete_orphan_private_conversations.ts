import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Supprime les conversations privées dont l'autre personne a été supprimée
 * (elles apparaissaient sous le nom « Conversation »). Leurs messages partent avec elles.
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db
        .from('conversations')
        .where('type', 'private')
        .whereIn('id', (query) =>
          query
            .from('conversation_members')
            .select('conversation_id')
            .groupBy('conversation_id')
            .havingRaw('count(*) < 2')
        )
        .delete()

      // Conversation privée sans aucun membre
      await db
        .from('conversations')
        .where('type', 'private')
        .whereNotExists((query) =>
          query
            .from('conversation_members')
            .select('id')
            .whereColumn('conversation_members.conversation_id', 'conversations.id')
        )
        .delete()
    })
  }

  // Les conversations supprimées ne peuvent pas être restaurées
  async down() {}
}

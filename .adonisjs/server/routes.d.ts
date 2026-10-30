import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'event_stream': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'email.confirm': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'password.forgot': { paramsTuple?: []; params?: {} }
    'password.store': { paramsTuple?: []; params?: {} }
    'password.edit': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'password.update': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'messages.search': { paramsTuple?: []; params?: {} }
    'conversations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'conversations.store': { paramsTuple?: []; params?: {} }
    'messages.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'messages.typing': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'messages.read': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'attachments.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'messages.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'messages.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users.block': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users.unblock': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'presence.ping': { paramsTuple?: []; params?: {} }
    'groups.store': { paramsTuple?: []; params?: {} }
    'groups.members.add': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'groups.members.remove': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'userId': ParamValue} }
    'groups.leave': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'profile.edit': { paramsTuple?: []; params?: {} }
    'profile.update': { paramsTuple?: []; params?: {} }
    'profile.password': { paramsTuple?: []; params?: {} }
    'avatars.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'profile.avatar': { paramsTuple?: []; params?: {} }
    'profile.avatar.destroy': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'admin.index': { paramsTuple?: []; params?: {} }
    'admin.users.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  GET: {
    'event_stream': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'email.confirm': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'password.forgot': { paramsTuple?: []; params?: {} }
    'password.edit': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'messages.search': { paramsTuple?: []; params?: {} }
    'conversations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'attachments.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'profile.edit': { paramsTuple?: []; params?: {} }
    'avatars.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.index': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'event_stream': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'email.confirm': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'password.forgot': { paramsTuple?: []; params?: {} }
    'password.edit': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'messages.search': { paramsTuple?: []; params?: {} }
    'conversations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'attachments.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'profile.edit': { paramsTuple?: []; params?: {} }
    'avatars.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.index': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'password.store': { paramsTuple?: []; params?: {} }
    'password.update': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'conversations.store': { paramsTuple?: []; params?: {} }
    'messages.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'messages.typing': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'messages.read': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'messages.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'messages.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users.block': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users.unblock': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'presence.ping': { paramsTuple?: []; params?: {} }
    'groups.store': { paramsTuple?: []; params?: {} }
    'groups.members.add': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'groups.members.remove': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'userId': ParamValue} }
    'groups.leave': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'profile.update': { paramsTuple?: []; params?: {} }
    'profile.password': { paramsTuple?: []; params?: {} }
    'profile.avatar': { paramsTuple?: []; params?: {} }
    'profile.avatar.destroy': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'admin.users.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}
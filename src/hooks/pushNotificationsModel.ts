export type PushSupport = 'checking' | 'supported' | 'unsupported';
export type LocalSubscriptionStatus = 'checking' | 'subscribed' | 'unsubscribed';
export type ServerSyncStatus = 'idle' | 'syncing' | 'synced' | 'error';
export type PushOperation = 'idle' | 'enabling' | 'disabling';

export interface PushNotificationState {
  support: PushSupport;
  permission: NotificationPermission;
  localSubscription: LocalSubscriptionStatus;
  serverSync: ServerSyncStatus;
  operation: PushOperation;
  endpoint: string | null;
  error: string | null;
}

export const initialPushNotificationState: PushNotificationState = {
  support: 'checking',
  permission: 'default',
  localSubscription: 'checking',
  serverSync: 'idle',
  operation: 'idle',
  endpoint: null,
  error: null,
};

export type PushNotificationAction =
  | { type: 'unsupported' }
  | { type: 'permission'; permission: NotificationPermission }
  | { type: 'local'; subscribed: boolean; endpoint: string | null }
  | { type: 'syncing' }
  | { type: 'synced' }
  | { type: 'operation'; operation: Exclude<PushOperation, 'idle'> }
  | { type: 'failed'; error: string; serverSync?: boolean }
  | { type: 'finished' };

export function pushNotificationReducer(
  state: PushNotificationState,
  action: PushNotificationAction,
): PushNotificationState {
  switch (action.type) {
    case 'unsupported':
      return { ...state, support: 'unsupported', localSubscription: 'unsubscribed' };
    case 'permission':
      return { ...state, support: 'supported', permission: action.permission };
    case 'local':
      return {
        ...state,
        localSubscription: action.subscribed ? 'subscribed' : 'unsubscribed',
        endpoint: action.endpoint,
      };
    case 'syncing':
      return { ...state, serverSync: 'syncing' };
    case 'synced':
      return { ...state, serverSync: 'synced' };
    case 'operation':
      return { ...state, operation: action.operation, error: null };
    case 'failed':
      return {
        ...state,
        operation: 'idle',
        serverSync: action.serverSync ? 'error' : state.serverSync,
        error: action.error,
      };
    case 'finished':
      return { ...state, operation: 'idle', error: null };
  }
}

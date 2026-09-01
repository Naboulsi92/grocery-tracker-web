## Parent

<!-- If this ticket is a child of a parent issue, reference it here -->

## What to build

Users can click "Désactiver" on the notifications card to unsubscribe from push notifications. The button appears when permission is 'granted'.

## Acceptance criteria

- [ ] "Désactiver" button appears on notifications card when permission is 'granted'
- [ ] Clicking the button calls unsubscribe() from usePushNotifications hook
- [ ] Push subscription is removed from database
- [ ] UI updates to show "Activer" button after deactivation

## Blocked by

- None (can start immediately)
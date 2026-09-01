## Problem Statement

Users have two issues with the current grocery tracker app:

1. **Notifications**: Once a user activates push notifications, there is no way to deactivate them. The UI only shows an "Activer" button when notifications are not granted, but provides no option to unsubscribe or disable notifications once enabled.

2. **Members**: The home page displays a "Membres" card showing an invite code, but clicking the card does nothing - it's not a clickable link and no members page exists. Users don't know what the code is for or how to manage household members.

## Solution

1. **Notifications**: Add a "Désactiver" button to the notifications card on the home page when notifications are currently granted. This button will call the `unsubscribe` function from `usePushNotifications` hook to remove the push subscription and update the UI.

2. **Members**: Transform the static "Membres" card into a clickable Link that navigates to a new `/members` page. The members page will display:
   - The household invite code prominently
   - A list of current household members with their email/display name
   - Instructions on how to use the invite code

## User Stories

1. As a user who has enabled notifications, I want to be able to disable notifications from the app, so that I can stop receiving push notifications if I no longer want them

2. As a household owner, I want to see who is in my household, so that I know who has access to the shared grocery list

3. As a household owner, I want to share an invite code with others, so that they can join my household

4. As a new user, I want to understand what the code on the Membres card is for, so that I can invite others to join my household

5. As a user, I want to click on the Membres card to access member management, so that I can easily navigate to view and manage household members

## Implementation Decisions

### Notifications Feature
- **Module**: Modify `src/app/home/page.tsx` to expose the `unsubscribe` function from `usePushNotifications` hook
- **UI Change**: Add a "Désactiver" button that appears when `permission === 'granted'`
- **Behavior**: The button should call `unsubscribe()`, update local permission state, and remove the subscription from the database

### Members Feature
- **New Page**: Create `src/app/members/page.tsx` - a new page accessible at `/members`
- **Route**: Add a Link component in `home/page.tsx` to make the Membres card clickable
- **Data**: Query `household_members` table joined with `auth.users` to display member information
- **Display**: Show the invite code (first 8 characters of household UUID) prominently with a copy-to-clipboard feature

### Database Queries
- Members page will query:
  - `household_members` table filtered by current user's household_id
  - Join with `auth.users` to get email addresses (or use a trigger to store display name in household_members)

## Testing Decisions

- **Notifications**: Test that clicking "Désactiver" removes the push subscription from the database and updates the UI state to show "Activer" button again
- **Members Page**: Test that the page loads, displays the correct invite code, and shows household members
- **Navigation**: Test that clicking the Membres card navigates to `/members`

## Out of Scope

- Push notification server-side implementation (VAPID keys, service worker)
- Removing members from a household
- Member roles/permissions (owner vs member)
- Re-inviting members
- Email-based invite system

## Further Notes

- The invite code system already works - users can join a household by entering the code on `/join-household` page
- The `unsubscribe` function already exists in `usePushNotifications.ts` but is not exposed to the UI
- The household ID serves as the invite code (first 8 characters displayed for brevity)
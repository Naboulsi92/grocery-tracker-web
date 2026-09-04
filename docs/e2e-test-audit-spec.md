# E2E Test Audit & Gap Analysis Spec

## Problem Statement

The CI/CD pipeline is failing due to incomplete E2E test coverage. Critical user flows—specifically the join household flow and to-buy list functionality—have zero test coverage. This gap allows regressions to reach production, creates unstable builds, and prevents confident deployment of new features. The existing 44 tests across 4 files cover only ~50% of the application's 9 routes, leaving significant functionality unvalidated.

## Solution

Systematic audit of current E2E test coverage, identification of all gaps across the application, and creation of comprehensive test scenarios organized by priority. This spec defines what tests must be written to achieve full coverage of critical user paths, ensuring all core functionality is validated before deployment.

## User Stories

### Critical Path - Join Household Flow (0 current tests)

1. As a new user who just signed up, I want to create a new household so that I can start managing my grocery list

2. As a new user who just signed up, I want to join an existing household using an invitation code so that I can collaborate with my household members

3. As a user on the join household page, I want to see clear options for both creating and joining so that I understand my onboarding choices

4. As a user creating a household, I want to optionally provide a custom name so that I can personalize my household

5. As a user creating a household, I want to create a household without a name so that I can use the default "Mon Foyer"

6. As a user joining a household, I want to enter a full invitation token so that I can successfully join

7. As a user joining a household, I want to see an error message if the invitation token is invalid so that I understand why joining failed

8. As a user joining a household, I want to see an error message if the invitation token has expired so that I know to request a new one

9. As a user on the join household page, I want to be redirected to login if I'm not authenticated so that I'm protected from unauthorized access

10. As a user on the join household page, I want to be redirected to home if I'm already a household member so that I don't create duplicate households

11. As a user creating a household, I want to see a loading state during creation so that I know the action is in progress

12. As a user joining a household, I want to see a loading state during joining so that I know the action is in progress

13. As a user after successfully creating or joining a household, I want to be redirected to the home page so that I can start using the app

14. As a user on the join household page, I want the invitation token input to be auto-completed disabled so that my code is not exposed

15. As a user on the join household page, I want the invitation token input to be required so that I cannot submit without a code

### Critical Path - To-Buy List (0 current tests)

16. As a household member, I want to see all items that are below their low stock threshold so that I know what to buy

17. As a household member, I want to see an empty state when all items are adequately stocked so that I know nothing needs to be purchased

18. As a household member, I want to see item names, current quantities, and thresholds so that I can make informed purchasing decisions

19. As a household member, I want to see category icons for each item so that I can quickly identify item types

20. As a household member, I want to see unit abbreviations (e.g., "pcs", "kg") so that I understand the measurement type

21. As a household member, I want to increment item quantities by clicking an "Add" button so that I can update stock levels

22. As a household member, I want to see items filtered to only show those below threshold so that the list is actionable

23. As a household member, I want items to disappear from the to-buy list after their quantity meets the threshold so that the list stays current

24. As a household member, I want to see a loading state while data is being fetched so that I know the page is loading

25. As a household member, I want to see an error message if data fetching fails so that I understand what went wrong

26. As a household member, I want to see a retry button when an error occurs so that I can attempt to reload the data

27. As a household member, I want the to-buy page to update in real-time when other members modify items so that I always see current stock levels

28. As a household member, I want to navigate back to the home page from the to-buy page so that I can access other features

29. As a user on the to-buy page, I want the back link to be accessible via aria-label so that screen readers can navigate properly

30. As a user with many items to buy, I want items to render with a staggered animation so that the list feels responsive

### Category Management - Feature Completeness (partial coverage)

31. As a household member, I want to create a new category with a name so that I can organize my items

32. As a household member, I want to delete a category so that I can remove unused categories

33. As a household member, I want to see an empty state when no categories exist so that I know I should create one

34. As a household member, I want to edit an existing category name so that I can correct typos or update naming

35. As a household member, I want to see a confirmation dialog before deleting a category so that I don't accidentally lose data

36. As a household member, I want to see an error message if category creation fails so that I understand the issue

37. As a household member, I want to see an error message if category deletion fails so that I understand the issue

38. As a household member, I want to see categories sorted alphabetically so that I can find them easily

39. As a household member, I want to see category icons if they exist so that I can visually identify categories

### Item Management - Feature Completeness (partial coverage)

40. As a household member, I want to create a new item with a name so that I can add it to my catalog

41. As a household member, I want to create a new item with a quantity so that I can track stock levels

42. As a household member, I want to create a new item with a category so that I can organize it

43. As a household member, I want to create a new item with a low stock threshold so that I know when to reorder

44. As a household member, I want to delete an item so that I can remove unused items

45. As a household member, I want to edit an existing item's name so that I can correct typos

46. As a household member, I want to edit an existing item's quantity so that I can adjust stock

47. As a household member, I want to edit an existing item's category so that I can reorganize

48. As a household member, I want to edit an existing item's threshold so that I can change reorder points

49. As a household member, I want to increment an item's quantity atomically so that concurrent updates don't conflict

50. As a household member, I want to decrement an item's quantity atomically so that concurrent updates don't conflict

51. As a household member, I want to see an empty state when no items exist so that I know I should create one

52. As a household member, I want to see an error message if item creation fails so that I understand the issue

53. As a household member, I want to see an error message if item deletion fails so that I understand the issue

54. As a household member, I want to see items sorted alphabetically so that I can find them easily

55. As a household member, I want to see items with their category icons so that I can visually identify item types

### Real-Time Collaboration (0 current tests)

56. As a household member, I want to see item changes in real-time when another member updates them so that I always have current information

57. As a household member, I want to see category changes in real-time when another member modifies them so that I always have current information

58. As a household member, I want Supabase subscriptions to automatically update the to-buy list so that I don't need to refresh manually

59. As a household member, I want real-time updates to be debounced so that rapid changes don't cause excessive re-fetches

60. As a household member, I want to see loading states during real-time updates so that I know changes are being processed

### Multi-User Scenarios (1 current test - needs expansion)

61. As an invited user, I want to join a household using an invitation token created by another member so that I can collaborate

62. As a household member, I want to see all members listed on the members page so that I know who has access

63. As a household member, I want to see the total member count in the page heading so that I know how many people are in my household

64. As a household member, I want to create an invitation token so that I can share it with others

65. As a household member, I want to see the invitation token displayed clearly so that I can copy it

66. As a household member, I want to copy an invitation token to clipboard so that I can share it easily

67. As a household member, I want to revoke an invitation token so that it can no longer be used

68. As a household member, I want to see that the invited user appears in the members list after joining so that I know they successfully joined

69. As a household member, I want to see that both users can access the same household data so that collaboration works

70. As a new user, I want to be able to sign up while another user is actively using the app so that multi-user onboarding works

### Error Handling & Edge Cases (minimal coverage)

71. As a user, I want to see a friendly error message when Supabase operations fail so that I understand what went wrong

72. As a user, I want to see specific error messages for duplicate household names so that I know to choose a different name

73. As a user, I want to see specific error messages for invalid invitation tokens so that I know to request a new one

74. As a user, I want to see error recovery options (retry buttons) when operations fail so that I can attempt to recover

75. As a user, I want to see loading states during all async operations so that I know the app is working

76. As a user, I want disabled buttons during mutations so that I don't accidentally submit multiple times

77. As a user, I want to see error boundaries that don't crash the entire app so that I can continue using other features

78. As a user, I want to see network error handling so that I understand when I'm offline

79. As a user, I want to see permission errors when trying to access another household's data so that I understand the access issue

### Empty States (not tested)

80. As a user viewing categories, I want to see a helpful empty state with a call-to-action so that I know to create categories

81. As a user viewing items, I want to see a helpful empty state with a call-to-action so that I know to create items

82. As a user viewing the to-buy list, I want to see a success message when all items are stocked so that I know everything is good

83. As a user viewing members, I want to see an empty state if no members exist (edge case) so that I understand the situation

84. As a user, I want empty states to include icons so that they are visually engaging

85. As a user, I want empty states to include explanatory text so that I understand why the list is empty

### Mobile Responsiveness (incomplete - only homepage tested)

86. As a mobile user at 320px viewport, I want the categories page to be usable so that I can manage categories on small screens

87. As a mobile user at 320px viewport, I want the items page to be usable so that I can manage items on small screens

88. As a mobile user at 320px viewport, I want the to-buy page to be usable so that I can view my shopping list on small screens

89. As a mobile user at 320px viewport, I want the members page to be usable so that I can view members on small screens

90. As a tablet user at 768px viewport, I want all pages to render correctly so that I can use the app on tablets

91. As a tablet user at 768px viewport, I want navigation to be accessible so that I can move between pages

92. As a small laptop user at 1024px viewport, I want all pages to render correctly so that I can use the app on smaller laptops

93. As a large desktop user at 1440px viewport, I want all pages to render correctly so that I can use the app on large screens

94. As a mobile user, I want touch targets to be large enough (44px minimum) so that I can tap them accurately

95. As a mobile user, I want forms to be usable on mobile so that I can create items and categories on the go

96. As a mobile user, I want the back button to be easily tappable on mobile so that I can navigate back

97. As a mobile user, I want lists to scroll properly on mobile so that I can see all items

98. As a mobile user, I want modals and dialogs to be usable on mobile so that I can interact with them

### Accessibility (quasi-inexistant)

99. As a screen reader user, I want all pages to have proper heading hierarchy so that I can navigate with headings

100. As a screen reader user, I want all interactive elements to have accessible names so that I can understand their purpose

101. As a screen reader user, I want loading states to be announced with role="status" so that I know content is loading

102. As a screen reader user, I want error messages to be announced with role="alert" so that I know about errors

103. As a screen reader user, I want form labels to be properly associated with inputs so that I know what each field is for

104. As a screen reader user, I want buttons to have descriptive names (not just icons) so that I understand their function

105. As a keyboard user, I want to navigate all pages using Tab so that I can use the app without a mouse

106. As a keyboard user, I want to activate all buttons using Enter or Space so that I can interact with the app

107. As a keyboard user, I want visible focus indicators on all interactive elements so that I know where I am

108. As a keyboard user, I want logical tab order that follows visual order so that navigation is predictable

109. As a keyboard user, I want forms to be completable without a mouse so that I can sign up and create items

110. As a color blind user, I want error states to be indicated by more than color so that I can identify errors

111. As a user with reduced motion preferences, I want animations to respect prefers-reduced-motion so that I don't experience motion sickness

112. As a screen reader user, I want icons to have aria-hidden when decorative so that they don't create noise

113. As a screen reader user, I want the theme toggle to have an accessible name so that I know its function

114. As a keyboard user, I want the FAQ accordion to be usable with keyboard so that I can expand and collapse items

115. As a screen reader user, I want the to-buy list items to have proper structure so that I can understand the list

### Authentication & Navigation Guards (basic coverage)

116. As an unauthenticated user, I want to be redirected to login when trying to access /home so that I'm protected

117. As an unauthenticated user, I want to be redirected to login when trying to access /categories so that I'm protected

118. As an unauthenticated user, I want to be redirected to login when trying to access /items so that I'm protected

119. As an unauthenticated user, I want to be redirected to login when trying to access /to-buy so that I'm protected

120. As an unauthenticated user, I want to see the marketing homepage at / so that I can learn about the app

121. As an authenticated user, I want to be redirected to /home when visiting / so that I can start using the app

122. As a user, I want to navigate between login and signup pages so that I can choose my authentication method

123. As a user, I want to see password validation errors before submission so that I can correct issues early

124. As a user, I want password fields to have minlength attributes so that browser validation works

## Implementation Decisions

### Test Organization Structure

**New Test Files to Create:**
- `join-household.spec.ts` - Complete join household flow tests
- `to-buy.spec.ts` - Complete to-buy list functionality tests
- `real-time.spec.ts` - Supabase subscription and real-time update tests
- `error-states.spec.ts` - Error handling and edge case tests
- `empty-states.spec.ts` - Empty state rendering tests
- `mobile-responsiveness.spec.ts` - Mobile/tablet responsiveness for all pages
- `accessibility.spec.ts` - WCAG 2.1 AA compliance tests

**Existing Files to Extend:**
- `categories.spec.ts` - Add edit, empty state, error handling tests
- `items.spec.ts` - Add edit, threshold, error handling tests
- `members.spec.ts` - Add copy invitation, revoke invitation tests
- `auth.spec.ts` - Add more navigation guard tests

### Data Setup Strategies

**Fixture Extensions:**
```typescript
// Add to fixtures.ts
export async function createCategory(page: Page, householdName: string, categoryData: { name: string; icon?: string })
export async function createItem(page: Page, householdName: string, itemData: { name: string; quantity?: number; threshold?: number; categoryId?: string })
export async function createInvitation(page: Page, householdName: string): Promise<string>
export async function joinWithInvitation(browser: Browser, account: Account, token: string, expectedHousehold: string)
```

**Randomization Pattern:**
- Continue using `randomUUID()` for all user-generated content (household names, category names, item names)
- Prefix all E2E data with `e2e-` for easy identification and cleanup
- Use `testInfo.parallelIndex` and `testInfo.retry` in account creation to avoid collisions

**Cleanup Strategy:**
- Leverage existing `test.afterEach` cleanup in fixtures.ts
- Ensure all created entities (categories, items, invitations) are tied to test accounts
- Use service role key for admin operations (user deletion, household deletion)

### Real-Time Testing Approach

**Supabase Channel Testing Pattern:**
```typescript
// Test real-time updates using multiple browser contexts
const context1 = await browser.newContext();
const context2 = await browser.newContext();
const page1 = await context1.newPage();
const page2 = await context2.newPage();

// Setup both pages with same household
await setupHousehold(page1, account1);
await setupHousehold(page2, account2);

// Navigate both to to-buy page
await page1.goto('/to-buy');
await page2.goto('/to-buy');

// Modify item from page1
await page1.getByRole('button', { name: /Ajouter/ }).click();

// Verify page2 receives update within timeout
await expect(page2.locator('.to-buy-item')).toHaveCount(expectedCount, { timeout: 5000 });

await context1.close();
await context2.close();
```

**Debounce Testing:**
- Test that rapid changes trigger only one re-fetch (use network interception to count requests)
- Verify 300ms debounce delay is respected

**Subscription Lifecycle:**
- Verify channel subscription is established on page load
- Verify channel is properly cleaned up on page navigation
- Test that re-subscription works after network interruption

### Multi-User Testing Patterns

**Browser Context Pattern:**
- Use `browser.newContext()` to create isolated browser sessions
- Create separate accounts for each user in the test
- Use `signUp()` helper for each account
- Use invitation flow to connect users to same household
- Verify data consistency across both sessions

**Parallel Test Isolation:**
- Each test creates its own household and accounts
- Use parallel index in account prefixes to avoid collisions
- Cleanup happens automatically in `test.afterEach`

### Error State Testing Methodology

**Error Simulation Strategies:**
1. **Network Errors:** Use `page.route()` to intercept and fail requests
2. **Supabase Errors:** Mock Supabase client to return error responses
3. **Validation Errors:** Submit invalid data to trigger server-side validation
4. **Permission Errors:** Attempt to access another household's data

**Error Verification Pattern:**
```typescript
test('shows error when category creation fails', async ({ page, account }) => {
  await createHousehold(page, account);
  await page.getByTestId('dashboard-card-categories').click();
  
  // Mock Supabase to return error
  await page.route('**/*.json', async (route) => {
    if (route.request().url().includes('rpc')) {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ error: 'Duplicate key value violates unique constraint' }),
      });
      return;
    }
    await route.continue();
  });
  
  await page.getByTestId('btn-new-category').click();
  await page.getByTestId('input-category-name').fill('Duplicate Category');
  await page.getByTestId('btn-create-category').click();
  
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Impossible de créer la catégorie');
});
```

**Retry Pattern Testing:**
- Verify retry button appears on error
- Verify retry button re-attempts the failed operation
- Verify success state after retry

## Testing Decisions

### What Constitutes a Good E2E Test

**External Behavior Only:**
- Test user-visible outcomes, not implementation details
- Verify DOM state, not JavaScript state
- Test through the UI, not direct API calls
- Validate navigation URLs, not route configuration

**Test Structure:**
```typescript
test('describes the user action and expected outcome', async ({ page, account }) => {
  // 1. Setup: Get user to the right starting state
  await createHousehold(page, account);
  await page.goto('/categories');
  
  // 2. Action: Perform the user interaction
  await page.getByTestId('btn-new-category').click();
  await page.getByTestId('input-category-name').fill('New Category');
  await page.getByTestId('btn-create-category').click();
  
  // 3. Assertion: Verify the outcome
  await expect(page.getByText('New Category')).toBeVisible({ timeout: 10000 });
});
```

**Avoid:**
- Testing implementation details (function names, variable names)
- Testing internal state (unless exposed via data-testid)
- Testing things that are better tested as unit tests
- Over-specifying UI details (colors, exact pixel positions)

### Priority Framework

**Priority Levels:**
- **P0 - Critical:** Core user flows that must work (join household, to-buy list, CRUD operations)
- **P1 - High:** Error handling, empty states, mobile responsiveness
- **P2 - Medium:** Accessibility, real-time collaboration, edge cases
- **P3 - Low:** Performance tests, visual regressions, nice-to-have scenarios

**Phase Assignment:**
- Phase 1: All P0 tests
- Phase 2: P1 tests + P0 edge cases
- Phase 3: P2 tests
- Phase 4: P3 tests + performance/accessibility deep dive

### Flaky Test Prevention Strategies

**Wait Strategies:**
- Use `waitForURL()` with explicit timeouts after navigation
- Use `toBeVisible({ timeout: 10000 })` for async DOM updates
- Avoid `setTimeout()` - use Playwright's auto-waiting
- Use `page.waitForLoadState('networkidle')` for full page loads

**Selector Stability:**
- Use `data-testid` for dynamic content (items, categories)
- Use `getByRole()` for static UI elements
- Avoid CSS selectors that depend on structure
- Use text content with regex for dynamic strings

**Parallel Execution:**
- Set `test.describe.configure({ mode: 'parallel' })` for independent tests
- Use `testInfo.parallelIndex` in account naming
- Ensure tests don't share state

**Retry Configuration:**
- Configure `retries: 2` in playwright.config for flaky-prone tests
- Use `test.slow()` for performance tests
- Mark real-time tests as potentially slow

### Integration with Existing Infrastructure

**Playwright Configuration:**
- Extend existing `playwright.config.ts`
- Maintain existing timeout settings (30s default, 60s for slow tests)
- Keep existing browser configuration (Chromium, Firefox, WebKit)

**CI/CD Integration:**
- Run tests in GitHub Actions workflow
- Use matrix strategy for different browsers
- Configure artifact upload for screenshots on failure
- Set up test reporting (allure, junit)

**Environment Handling:**
- Respect `e2eEnvironment.writesAllowed` flag
- Skip write tests when service role key not available
- Use `E2E_SUPABASE_URL` and `E2E_SUPABASE_SERVICE_ROLE_KEY` for cleanup

**Test Tags:**
- Use `@smoke` for critical path tests
- Use `@mobile` for mobile responsiveness tests
- Use `@a11y` for accessibility tests
- Use `@realtime` for real-time update tests

## Out of Scope

**Unit Tests:**
- Component unit tests (handled by Jest/Vitest)
- Hook unit tests (handled by React Testing Library)
- Utility function tests (handled by Jest)

**Integration Tests:**
- API endpoint testing (Supabase handles this)
- Database query testing (Supabase RLS handles this)
- Third-party service integration tests

**Visual Regression Testing:**
- Pixel-perfect visual comparisons
- Screenshot-based regression testing
- Design system compliance (beyond accessibility)

**Load/Performance Testing:**
- Concurrent user load testing
- Stress testing under heavy load
- Infrastructure capacity testing

**Cross-Browser Deep Dive:**
- Full browser matrix testing (focus on Chromium for E2E)
- Legacy browser support testing
- Mobile browser-specific testing (beyond responsive viewports)

**Security Testing:**
- Penetration testing
- Vulnerability scanning
- RLS policy testing (handled by Supabase advisors)

## Further Notes

### Test Execution Strategy

**Running New Tests:**
```bash
# Run all new tests
npx playwright test join-household.spec.ts
npx playwright test to-buy.spec.ts
npx playwright test real-time.spec.ts

# Run specific test file with UI mode
npx playwright test join-household.spec.ts --ui

# Run with trace viewer for debugging
npx playwright test join-household.spec.ts --trace on

# Run only mobile tests
npx playwright test --grep @mobile

# Run only accessibility tests
npx playwright test --grep @a11y
```

### Reporting & Metrics

**Coverage Tracking:**
- Track line coverage of tested routes
- Measure percentage of user stories implemented
- Monitor flaky test rate over time

**Quality Gates:**
- Block merge if P0 tests fail
- Require 90%+ P0 test coverage before production deploy
- Target <1% flaky test rate

### Maintenance Considerations

**Selector Maintenance:**
- Use semantic selectors (`getByRole`, `getByLabel`) over structural
- Use `data-testid` for dynamic content only
- Document selector strategy in test README

**Test Data Management:**
- Clean up test accounts after each run
- Monitor Supabase storage for test data accumulation
- Rotate test credentials periodically

**Documentation:**
- Update this spec when adding new test categories
- Document new test helpers in fixtures.ts
- Maintain test runbook for new contributors

### Success Criteria

**Phase 1 Completion:**
- [ ] Join household flow: 100% test coverage (15 tests)
- [ ] To-buy list: 100% test coverage (15 tests)
- [ ] All P0 tests passing in CI

**Phase 2 Completion:**
- [ ] Category CRUD: 100% test coverage (9 tests)
- [ ] Item CRUD: 100% test coverage (15 tests)
- [ ] Error states: All error scenarios tested (8 tests)
- [ ] Empty states: All empty states tested (5 tests)
- [ ] Mobile responsiveness: All pages tested (9 tests)

**Phase 3 Completion:**
- [ ] Real-time updates: All scenarios tested (5 tests)
- [ ] Multi-user collaboration: All scenarios tested (10 tests)
- [ ] Accessibility: WCAG 2.1 AA compliance (15 tests)

**Phase 4 Completion:**
- [ ] Performance tests: All metrics validated (5 tests)
- [ ] Edge cases: All identified edge cases tested (10 tests)
- [ ] Total test count: 120+ E2E tests

**Overall Success:**
- Zero critical user flows untested
- CI/CD pipeline stable with <1% flaky rate
- All P0, P1 tests passing on every commit
- Full mobile responsiveness coverage
- WCAG 2.1 AA compliance validated

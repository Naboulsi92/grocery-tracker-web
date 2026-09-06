<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Grocery Tracker Web - Agent Best Practices

## 🚀 Deployment & Environment

1. **Environment Variables for All Environments**
   - Always add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to **Preview**, **Production**, AND **Development** environments in Vercel
   - This prevents failed Preview deployments and enables PR reviews
   - Use `.env.local.example` as a template for new contributors

2. **Never Commit Secrets**
   - `.env.local` is in `.gitignore` ✅
   - Only commit `.env.local.example` with placeholder values

3. **Verify Environment Variables Before Deploying**
   - Check Vercel dashboard: Settings → Environment Variables
   - Ensure variables exist for the target environment (Preview/Production)

4. **Environment Semantics: Preview / Development / Production**
   - Env-var changes only apply to **new** deployments — redeploy after changing a value
   - Preview vars can be scoped per branch: `vercel env add <VAR> preview <branch>` (overrides the default preview value)
   - Full reference (Vercel/GitHub/Supabase environments, Supabase preview branching, end-to-end flow): `docs/research/github-vercel-supabase-environments.md`

## 📝 Git & PR Workflow

5. **Delete Branches After Merge**
   - After merging a PR, delete the feature branch to keep the repo clean
   - In GitHub: Close PR → "Delete branch" button
   - Or: `git push origin --delete <branch-name>`

6. **Write Descriptive PRs**
   - Include what changed, why, and how to test
   - Link to issues: "Closes #27"
   - Add screenshots for UI changes

7. **Branch Naming Convention**
   - `feature/<description>` for new features
   - `fix/<description>` for bug fixes
   - `docs/<description>` for documentation

## 🧪 Testing

8. **Run Tests Before Pushing**
   ```bash
   npm run typecheck    # TypeScript checks
   npm test             # Unit tests
   npx playwright test  # E2E tests
   ```

9. **Add Tests for New Features**
   - Unit tests for new hooks/components
   - E2E tests for critical user flows (signup, login, core features)
   - Test both success and error cases

10. **Maintain Test Coverage**
   - Keep existing tests passing
   - Add regression tests for bug fixes

## 🔒 Security

11. **Supabase Row Level Security (RLS)**
    - Always test RLS policies with different user roles
    - Ensure users can only access their own household data
    - Review policies when adding new tables

12. **Environment Variable Usage**
    - Use `NEXT_PUBLIC_*` only for truly public values
    - Never expose service role keys or secrets
    - Validate environment variables at startup

## 📊 Monitoring & CI/CD

13. **GitHub Actions**
    - Run tests on every PR
    - Block merges if tests fail
    - Use the existing workflow in `.github/workflows/`

14. **Vercel Deploy Previews**
    - Share preview URLs for team review
    - Test on real devices before merging
    - Check deployment logs for errors

15. **Monitor Production**
    - Watch Vercel deployment status
    - Monitor Supabase dashboard for API usage
    - Set up alerts for critical failures

## 🎨 Code Quality

16. **TypeScript First**
    - Use strict mode (already enabled ✅)
    - Avoid `any` - use proper types
    - Define interfaces for API responses and database rows

17. **Component Structure**
    - Keep components small and focused
    - Extract custom hooks for reusable logic
    - Use composition over prop drilling

18. **Error Handling**
    - Handle Supabase errors gracefully
    - Show user-friendly error messages
    - Log errors for debugging (but not secrets!)

19. **Code Comments**
    - Comment complex logic
    - Explain "why" not just "what"
    - Update comments when refactoring

## 📚 Documentation

20. **Keep README.md Updated**
    - Local development setup steps
    - Environment variable requirements
    - How to run tests
    - Deployment process

21. **Document New Features**
    - Add to `CONTEXT.md` if they affect domain model
    - Update API documentation if endpoints change
    - Add ADRs for major architectural decisions

## 🔄 Agent-Specific Guidelines

22. **Use Parallel Sub-Agents**
    - For code reviews: Run Standards and Spec reviews in parallel
    - For large tasks: Split work by files/modules
    - Always use separate branches for parallel agent work

23. **Follow the Code Review Skill**
    - Two-axis review: Standards + Spec
    - Use `code-review` skill for PR reviews
    - Post findings directly to PR

24. **Bug Diagnosis Process**
    - Build a tight feedback loop first (Phase 1)
    - Don't hypothesize without a repro
    - Use the `diagnosing-bugs` skill for hard bugs

25. **Issue Tracker Integration**
    - Use GitHub Issues for tracking work
    - Link PRs to issues
    - Follow the workflow in `docs/agents/issue-tracker.md`

## 🛠️ MCP Tools & CLI Usage

26. **GitHub CLI (`gh`)** — Use for all GitHub operations:
    ```bash
    # Issues
    gh issue list --limit 20
    gh issue view <number> --json title,body,labels
    gh issue create --title "..." --body "..."
    gh issue close <number> --reason completed
    gh issue comment <number> --body "..."

    # PRs
    gh pr create --title "..." --body "..."
    gh pr view <number> --json title,body,state
    gh pr merge <number> --squash --delete-branch
    gh pr list --state open

    # Runs/Workflow
    gh run list --limit 5
    gh run view <run-id> --log-failed
    gh run watch <run-id> --interval 30
    ```

27. **Supabase MCP** — Use for database operations (no local CLI needed):
    - `supabase_list_tables` — Inspect schema
    - `supabase_execute_sql` — Run queries / test functions
    - `supabase_apply_migration` — Apply migrations to linked project
    - `supabase_list_migrations` — Check migration status
    - `supabase_get_advisors` — Security/performance checks
    - `supabase_generate_typescript_types` — Sync types
    - Prefer MCP over local `supabase` CLI for remote projects

28. **Vercel MCP** — Use for deployment/preview operations:
    - `vercel_list_projects` / `vercel_get_project` — Project info
    - `vercel_list_deployments` — Deployment history
    - `vercel_get_deployment` / `vercel_get_deployment_build_logs` — Debug builds
    - `vercel_get_runtime_logs` / `vercel_get_runtime_errors` — Production debugging
    - `vercel_create_git_project` — Link repo for auto-deploy
    - `vercel_web_fetch_vercel_url` — Access protected preview URLs

29. **Context7** — Use for up-to-date library documentation:
    - Always call `context7_resolve-library-id` first
    - Then `context7_query-docs` with specific questions
    - Use for: Next.js, Supabase, Vercel, React, Tailwind, etc.
    - Don't rely on training data for API syntax

## 🎯 Quick Reference Commands

```bash
# Type checking
npm run typecheck

# Run all tests
npm test

# Run E2E tests
npx playwright test

# Run specific test file
npx playwright test src/e2e/homepage.spec.ts

# Linting
npm run lint

# Build for production
npm run build

# Local development
npm run dev
```

## 🚨 Common Pitfalls to Avoid

- ❌ Don't commit `.env.local` with real credentials
- ❌ Don't merge without running tests first
- ❌ Don't add environment variables to only Production (add to Preview too!)
- ❌ Don't leave feature branches active after merge
- ❌ Don't use `any` in TypeScript without justification
- ❌ Don't hardcode API keys or secrets
- ❌ Don't skip error handling for Supabase operations
- ❌ Don't forget to update tests when changing behavior

## ✅ Pre-Deployment Checklist

Before merging a PR:
- [ ] All tests pass (unit + E2E)
- [ ] Typecheck passes
- [ ] Linting passes
- [ ] Manual testing on local dev server
- [ ] Environment variables configured for Preview (if new variables added)
- [ ] PR description is clear and links to issues
- [ ] No console errors or warnings
- [ ] Responsive design tested (mobile, tablet, desktop)

After merging:
- [ ] Verify Production deployment succeeds in Vercel
- [ ] Test live site functionality
- [ ] Delete feature branch
- [ ] Close linked issues

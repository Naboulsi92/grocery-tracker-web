# Building an "Agentic Loop" / Persistent Goal in OpenCode

**Summary.** OpenCode has no single "goal loop" feature you switch on; it gives you composable first-class primitives — persistent instructions (`AGENTS.md` + the `instructions` config), declarative agents (primary/subagent), slash commands, loadable skills, an in-session todo tracker, subagent delegation via the `task` tool, permissions (including an autonomous-loop-relevant `doom_loop` guard), and MCP servers — plus the core agentic loop (think → act → observe → repeat) that drives every session. This document maps each numbered topic from the research brief to its primary source and shows the strongest pattern for a long-running, goal-driven agent: a primary "worker" agent, an independent "judge" subagent, a persistent `todowrite` checklist, and permissions tuned for autonomy (`doom_loop: deny`, auto-approve). Everything below is cited to the official docs and the opencode source at [github.com/anomalyco/opencode](https://github.com/anomalyco/opencode) (default branch `dev`).

---

## 1. AGENTS.md — the persistent instruction layer

Rules are just markdown files injected into the LLM's context. See the docs on [Rules](https://opencode.ai/docs/rules).

- **Project rules:** an `AGENTS.md` in the project root applies whenever you work in that directory tree. **Global rules:** `~/.config/opencode/AGENTS.md` applies to every session. For Claude Code migrants, `CLAUDE.md` and `~/.claude/CLAUDE.md` are read as fallbacks ([Rules → Types](https://opencode.ai/docs/rules#types)).
- **Precedence:** opencode looks up local files by traversing up from the current directory (`AGENTS.md`, then `CLAUDE.md`), then the global file, then `~/.claude/CLAUDE.md`; the first matching file wins in each category ([Rules → Precedence](https://opencode.ai/docs/rules#precedence)).
- **Source of the load order:** [`instruction.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/session/instruction.ts) — the candidates are exactly `["AGENTS.md", "CLAUDE.md", "CONTEXT.md"]` (CONTEXT.md marked deprecated), global files are `~/.config/opencode/AGENTS.md` and `~/.claude/CLAUDE.md`, and content is prefixed with `Instructions from: <path>` when attached.
- **More instruction sources** via config: the `instructions` array accepts local paths, globs, and `https://`/`http://` URLs (fetched with a 5-second timeout, per both the [Rules → Custom Instructions](https://opencode.ai/docs/rules#custom-instructions) docs and `instruction.ts`) — useful for pulling a shared, versioned "goal file" from a repo.
- **Lazy, on-demand loading:** instruction files are also attached automatically when the agent reads a file in a directory, walking up to the worktree and attaching nearby `AGENTS.md`/`CLAUDE.md`/`CONTEXT.md` once per assistant message (see `resolve()` in `instruction.ts`). The docs show a manual `@file` + Read-tool pattern for the same effect ([Rules → Manual Instructions in AGENTS.md](https://opencode.ai/docs/rules#manual-instructions-in-agentsmd)).

Practical reading for a persistent goal: put your standing goal/operating contract in `AGENTS.md` (e.g. the requirements-style block this repo already uses), and keep long-lived, shared standards in the `instructions` config so they load every session.

---

## 2. Custom agents — the declarative "who"

Agents are how you give a loop a role, a model, a temperature, a step budget, and tool permissions. Docs: [Agents](https://opencode.ai/docs/agents).

- **Two kinds of agents.** *Primary agents* are who you talk to (tab-cycle; tool access controlled by permissions). *Subagents* are launched by primary agents or `@mention`ed, and run in child sessions ([Agents → Types](https://opencode.ai/docs/agents#types), [Agents → Usage](https://opencode.ai/docs/agents#usage)).
- **Built-ins:** primary `build` (default; all tools) and `plan` (planning/analysis, edits+bash set to `ask` by default); subagents `general` (full tools except todo), `explore` (read-only), and `scout` (read-only dependency research); hidden system agents `compaction`, `title`, `summary` ([Agents → Built-in](https://opencode.ai/docs/agents#built-in)).
- **Configuration surface** (validated by the [config.json schema](https://opencode.ai/config.json) → `$defs.AgentConfig`): `model`, `variant`, `temperature`, `top_p`, `prompt`, `description`, `mode` (`subagent|primary|all`), `hidden`, `color`, `steps` ("Maximum number of agentic iterations before forcing text-only response"; legacy `maxSteps` deprecated), and `permission`.
- **Define agents two ways:** JSON in `opencode.json` (`agent` key) or Markdown frontmatter in `~/.config/opencode/agents/` or `.opencode/agents/` (filename becomes the agent name) ([Agents → Configure](https://opencode.ai/docs/agents#configure)). A `{file:./prompts/build.txt}` prompt reference points at an external prompt file, relative to the config. Use `opencode agent create` interactively ([Agents → Create agents](https://opencode.ai/docs/agents#create-agents)).
- **Per-agent permissions**: `permission` on an agent merges with — and overrides — the global `permission` object ([Agents → Permissions](https://opencode.ai/docs/agents#permissions)). Task permissions (`permission.task` with globs) control which subagents an agent may invoke via the `task` tool, and `deny` removes the subagent from the description entirely ([Agents → Task permissions](https://opencode.ai/docs/agents#task-permissions)).
- **Default agent:** `default_agent` sets which primary agent a session starts with; must be primary, falls back to `build` if it doesn't exist or is a subagent ([Config → Default agent](https://opencode.ai/docs/config#default-agent)).
- **Nesting subagents:** `subagent_depth` (default `1` — a subagent cannot spawn another subagent; `2` allows one nested level; `0` forbids all launches) ([Config → Subagent depth](https://opencode.ai/docs/config#subagent-depth)). Enforcement lives in the `task` tool — [`task.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/tool/task.ts) walks `parentID` chain and fails when `depth >= (cfg.subagent_depth ?? 1)`.

For a persistent goal you want a **primary** worker agent (to hold the session) plus one or more **subagent** specialists (e.g. an independent evaluator) that the worker spawns with `task`.

---

## 3. Commands — goal entry points

Slash commands are prompts that run templates with argument substitution, optionally on a specific agent or model. Docs: [Commands](https://opencode.ai/docs/commands).

- **Definition:** custom commands are Markdown files in `.opencode/commands/` (or `~/.config/opencode/commands/`, or JSON under the `command` config key); the filename is the command name; frontmatter fields are `description`, `agent`, `model`, `subtask`; the body is the template ([Commands → Create command files](https://opencode.ai/docs/commands#create-command-files), [Commands → Options](https://opencode.ai/docs/commands#options)).
- **Template syntax:** `$ARGUMENTS`, positional `$1 $2 $3`, shell-output injection with `!`command``, and file references with `@path` ([Commands → Prompt config](https://opencode.ai/docs/commands#prompt-config)).
- **`agent` + `subtask`:** `agent: <name>` makes the command run on that agent; if the agent is a subagent the command triggers a subagent invocation by default, and `subtask: true` forces subagent execution so the work doesn't pollute the primary context ([Commands → Agent](https://opencode.ai/docs/commands#agent), [Commands → Subtask](https://opencode.ai/docs/commands#subtask)).
- **Source:** command registration in [`command/index.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/command/index.ts) — `Info` = `{ name, description?, agent?, model?, source?, template, subtask?, hints }`; built-ins `init` ("guided AGENTS.md setup") and `review` are defined here; skills and MCP prompts are also surfaced as commands.

A `/goal "condition"`-style command is the natural entry point: template frontmatter with `subtask: true` (or an explicit subagent agent) that hands a persistent goal statement to the worker agent.

---

## 4. Skills — reusable capability blocks to load on demand

Skills are folders with a `SKILL.md` that the agent discovers and loads lazily through the native `skill` tool. Docs: [Agent Skills](https://opencode.ai/docs/skills).

- **Discovery locations:** `.opencode/skills/<name>/SKILL.md`, `~/.config/opencode/skills/<name>/SKILL.md`, plus Claude/agent-compatible `.claude/skills/` and `.agents/skills/` (project and global). Project lookup walks up from cwd to the git worktree; `config.skills.paths` and `config.skills.urls` add more sources ([Skills → Place files](https://opencode.ai/docs/skills#place-files), [Skills → Understand discovery](https://opencode.ai/docs/skills#understand-discovery); the exact scan patterns `{skill,skills}/**/SKILL.md`, `skills/**/SKILL.md` live in [`skill/index.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/skill/index.ts)).
- **Frontmatter:** only `name` (+ `description`) are required by official docs ([Skills → Write frontmatter](https://opencode.ai/docs/skills#write-frontmatter)); the loader additionally accepts optional `license`, `compatibility`, `metadata`, and ignores unknown fields (source: `skill/index.ts`, `isSkillFrontmatter`).
- **Availability is permission-gated:** `Permission.evaluate("skill", name, agent.permission)` — `deny` hides the skill entirely, `ask` prompts, `allow` loads immediately; overridable per agent ([Skills → Configure permissions](https://opencode.ai/docs/skills#configure-permissions), source in `skill/index.ts` `available()`).
- Skills double as commands — `command/index.ts` registers every skill as a `/name` command whose template is the skill body plus its base directory hint.

Skills are ideal for encoding the *procedure* of the loop (e.g. how to plan → act → evaluate) while `AGENTS.md` encodes the standing goal.

---

## 5. Permissions, `doom_loop`, and loop-tuning options

### The permission engine
Permissions decide whether an action runs, prompts, or is blocked. Docs: [Permissions](https://opencode.ai/docs/permissions).

- **Three actions:** `"allow"` (run), `"ask"` (prompt), `"deny"` (block) ([Permissions → Actions](https://opencode.ai/docs/permissions#actions)).
- **Matching:** rules keyed by permission name, values are either a shorthand action or an object of glob→action (e.g. `bash: { "git *": "allow", "rm *": "deny" }`); **the last matching rule wins**, so the `"*"` catch-all goes first ([Permissions → Configuration](https://opencode.ai/docs/permissions#configuration), [Permissions → Granular Rules](https://opencode.ai/docs/permissions#granular-rules-object-syntax)). Wildcards: `*` = zero-or-more chars, `?` = one char; `~`/`$HOME` expand in patterns ([Permissions → Wildcards](https://opencode.ai/docs/permissions#wildcards)).
- **Available permission keys** include `read`, `edit`, `glob`, `grep`, `bash`, `task`, `skill`, `lsp`, `question`, `webfetch`, `websearch`, `external_directory`, `todowrite`, and `doom_loop` ([Permissions → Available permissions](https://opencode.ai/docs/permissions#available-permissions)). Keys are wildcard-matched against tool names, so MCP tools work too (e.g. `"mymcp_*": "deny"`, per [Permissions → Available permissions](https://opencode.ai/docs/permissions#available-permissions)).
- **Defaults:** permissive by default — most permissions `"allow"`; `doom_loop` and `external_directory` default to `"ask"`; `read` allows everything except `.env` files ([Permissions → Defaults](https://opencode.ai/docs/permissions#defaults)). Source-grounding for the engine: [`permission/index.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/permission/index.ts) `evaluate()` matches last rule via wildcard and falls back to `action: "ask"`.
- **Auto mode (`--auto`):** auto-approves anything not explicitly `"deny"`; usable with `opencode --auto` or `opencode run --auto "..."` ([Permissions → Auto mode](https://opencode.ai/docs/permissions#auto-mode)).

### The definitive `doom_loop` answer
`doom_loop` is a **stuck-loop safety guard**, not a loop feature. It defaults to `"ask"`.

- Docs definition: "**`doom_loop`** — triggered when the same tool call repeats 3 times with identical input" ([Permissions → Available permissions](https://opencode.ai/docs/permissions#available-permissions)); in the agents docs it's listed as "Recovery prompts when an agent appears stuck" ([Agents → Permissions](https://opencode.ai/docs/agents#permissions)).
- Source: [`session/processor.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/session/processor.ts) — `const DOOM_LOOP_THRESHOLD = 3`. On each `tool-call` event it takes `recentParts = parts.slice(-DOOM_LOOP_THRESHOLD)`; if the last 3 parts are all tool calls of the **same tool name** (`part.tool === value.name`) with **identical serialized input** (`JSON.stringify(part.state.input) === JSON.stringify(input)`), it calls `permission.ask({ permission: "doom_loop", patterns: [value.name], always: [value.name], ruleset: agent.permission })`.
- What that means in practice: the agent is *not* forcibly stopped; instead the permission engine asks the user (or follows a configured rule). Setting `doom_loop: "allow"` suppresses the recovery prompt so repeated identical calls proceed uninterrupted; `"deny"` blocks them. For autonomous loops you typically want `doom_loop: "deny"` or `"allow"` so iterative work isn't interrupted by recovery prompts (mirroring the guidance the community's goal-loop integrations set — the search surfaced `lindoelio/opencode-goal-worker`, which sets `doom_loop: deny`; noted as community practice, not an official source).

### Loop-tuning options (config.json schema + docs)
- `experimental.continue_loop_on_deny` — "Continue the agent loop when a tool call is denied" (from [`config.json` $defs](https://opencode.ai/config.json)) — directly relevant to keeping a loop alive when a permission denies.
- `experimental.primary_tools` — tools restricted to primary agents (enforced as child-tool denies in [`task.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/tool/task.ts)).
- `experimental.mcp_timeout`, `experimental.batch_tool`, `experimental.openTelemetry`, `experimental.policies` (provider-usage allow/deny) — all in [`config.json` $defs.Config.experimental](https://opencode.ai/config.json); docs note experimental keys are unstable ([Config → Experimental](https://opencode.ai/docs/config#experimental)).
- `steps` per agent bounds iterations ("maximum number of agentic iterations before forcing text-only response"); if unset, "the agent will continue to iterate until the model chooses to stop or the user interrupts" ([Agents → Max steps](https://opencode.ai/docs/agents#max-steps)).
- `compaction` — `auto` (compact when context full, default true), `prune` (drop old tool outputs), `reserved` token buffer ([Config → Compaction](https://opencode.ai/docs/config#compaction)); this is how long sessions survive context limits — a hidden `compaction` agent does the summarizing ([Agents → Built-in](https://opencode.ai/docs/agents#built-in)).
- `snapshot` — filesystem snapshots enable undo/revert during a session; disabling (`false`) sacrifices rollback to save disk/index time ([Config → Snapshot](https://opencode.ai/docs/config#snapshot)).

### Persistent state in the loop: the todo tool
- `todowrite`/`todoread` keep a session-scoped checklist; the `todoread` permission key gates `todowrite` + `todoread` ([Agents → Permissions](https://opencode.ai/docs/agents#permissions) — "`todowrite` — `todowrite`, `todoread`").
- Subagents are denied the todo tool by default unless their ruleset explicitly allows it (see `childToolDenies` in [`task.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/tool/task.ts)), reinforcing the pattern: the **primary** agent owns the persistent checklist. Implementation in [`todo.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/tool/todo.ts): the `todowrite` tool asks permission with `always: ["*"]`, then persists `todos`.

---

## 6. MCP — external tools and context

MCP servers extend the loop with external tools/context. Docs: [MCP servers](https://opencode.ai/docs/mcp-servers).

- **Local servers:** `type: "local"`, `command: ["npx", "-y", "…"]`, plus `environment`, `cwd`, `enabled`, `timeout` (default 5000 ms) ([MCP → Local](https://opencode.ai/docs/mcp-servers#local)). **Remote servers:** `type: "remote"`, `url`, `headers` (supports `{env:…}` substitution), `oauth` (auto flow, or `clientId`/`clientSecret`/`scope`; `oauth: false` disables), `timeout` ([MCP → Remote](https://opencode.ai/docs/mcp-servers#remote), [MCP → OAuth](https://opencode.ai/docs/mcp-servers#oauth)).
- **Tool availability:** every MCP tool appears alongside built-ins, keyed as `<server>_<tool>`. Enable/disable globally via `tools` globs, or **per agent** — disable globally then re-enable inside an agent's `tools` ([MCP → Manage](https://opencode.ai/docs/mcp-servers#manage)). MCP prompts also register as commands (source: `command/index.ts`).
- **Caveat from the docs:** MCP servers add tokens to context, so keep the set lean ([MCP → Caveats](https://opencode.ai/docs/mcp-servers#caveats)).
- The type definitions (`McpLocalConfig`, `McpRemoteConfig`, `McpOAuthConfig`) are in [`config.json` $defs](https://opencode.ai/config.json).

Useful to a goal loop: an external memory/knowledge store (e.g. Context7 for docs or a knowledge MCP server) so the long-running agent can look things up without bloating the session.

---

## 7. What the docs and source actually recommend for goal-driven/autonomous patterns

OpenCode does not ship a first-class "goal loop"; the docs author a **plan → build → review** workflow plus delegation primitives, and the source exposes the raw loop.

- **Built-in workflow:** the `plan` agent produces a plan (edits/bash default `ask`), then `plan_exit` (source: [`tool/plan.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/tool/plan.ts)) asks whether to switch to the `build` agent and injects "Execute the plan". The agents docs sell exactly this as workflow/therapy for no-surprise changes ([Agents → Built-in → Use plan](https://opencode.ai/docs/agents#use-plan), [Agents → Built-in → Use build](https://opencode.ai/docs/agents#use-build)).
- **Delegation:** the `task` tool launches subagents (foreground by default, optional background with `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true`), with `subagent_type`, `description`, `prompt`, optional `task_id` to resume a prior subagent session, and permission-gating on `task` ([Agents → Task permissions](https://opencode.ai/docs/agents#task-permissions); source: [`tool/task.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/tool/task.ts)). The `general` subagent is explicitly described as "a general-purpose agent for researching complex questions and executing multi-step tasks… to run multiple units of work in parallel" ([Agents → Built-in → Use general](https://opencode.ai/docs/agents#use-general)).
- **The raw loop itself:** the docs don't document it, but `session/processor.ts` shows the engine: a `Result = "compact" | "stop" | "continue"` — the session iterates `continue` until the model stops, compacts when context fills, and every `tool-call` runs the permission + doom-loop checks. `steps` bounds this in config.
- **Every session starts with the instruction layer** (§1) and the currently selected/default agent (§2), so a reproducible "goal environment" = `AGENTS.md` (goal + operating rules) + `default_agent` (worker) + `instructions` config (remote standards) + agent with `steps`/permissions.

---

## Recommendations (all building only on primitives above)

1. **Define the goal contract in `AGENTS.md`** (or a file included via the `instructions` config, so multiple repos share it), stating: the goal, acceptance criteria, commands to verify (per this repo's `AGENTS.md` conventions), and a hard rule like "stop and report when X, never loop past Y attempts". This is loaded every session for free ([Rules](https://opencode.ai/docs/rules), [`instruction.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/session/instruction.ts)).
2. **Create a primary worker agent** in `.opencode/agents/worker.md` with `mode: primary`, a model, `description`, `prompt` (the loop procedure), and permissions that `deny` destructive/surprising ops while `allow`ing the worker's core toolchain ([Agents → Configure](https://opencode.ai/docs/agents#configure), [Agents → Permissions](https://opencode.ai/docs/agents#permissions)). Set it via `default_agent` ([Config → Default agent](https://opencode.ai/docs/config#default-agent)). Leave `steps` unset for long loops or set it as a cost cap ([Agents → Max steps](https://opencode.ai/docs/agents#max-steps)).
3. **Add an evaluator subagent** (`mode: subagent`) an independent judge that the worker calls with `task` to check "is the goal met?"; give `general`-like read-only access and `mode: subagent` so it runs in a child session. Wire `task` permission to allow only your two agents ([Agents → Task permissions](https://opencode.ai/docs/agents#task-permissions), [`tool/task.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/tool/task.ts)).
4. **Track progress with `todowrite`** on the primary agent; expect subagents to lack the tool by default ([Agents → Permissions](https://opencode.ai/docs/agents#permissions), [`tool/todo.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/tool/todo.ts)).
5. **Tune permissions for autonomy:** `permission: { "*": "allow" }` plus explicit exceptions; set `doom_loop: "deny"` (or `"allow"`) so the recovery prompt doesn't interrupt iterative work, and `experimental.continue_loop_on_deny: true` to keep the loop going if a tool is denied ([Permissions → Configuration](https://opencode.ai/docs/permissions#configuration), [config.json](https://opencode.ai/config.json), [Permissions → Available permissions](https://opencode.ai/docs/permissions#available-permissions)). For unattended runs, `opencode run --auto` auto-approves anything not denied ([Permissions → Auto mode](https://opencode.ai/docs/permissions#auto-mode)).
6. **Expose the loop as a command:** `.opencode/commands/goal.md` with frontmatter `agent: <worker>` (or `subtask: true`) and a template that states the goal via `$ARGUMENTS` ([Commands → Agent/Subtask](https://opencode.ai/docs/commands#agent), [Commands → Arguments](https://opencode.ai/docs/commands#arguments)).
7. **Package reusable procedure in a skill** (`.opencode/skills/<name>/SKILL.md`) so the worker can load the loop procedure on demand, and reuse it across agents ([Skills](https://opencode.ai/docs/skills)).
8. **Let compaction handle long sessions** (default `auto: true`), keep `snapshot` on to allow rollbacks, and add MCP only where it visibly pays off ([Config → Compaction](https://opencode.ai/docs/config#compaction), [Config → Snapshot](https://opencode.ai/docs/config#snapshot), [MCP → Caveats](https://opencode.ai/docs/mcp-servers#caveats)).

---

## Key primary sources

- Docs: [Rules](https://opencode.ai/docs/rules) · [Agents](https://opencode.ai/docs/agents) · [Commands](https://opencode.ai/docs/commands) · [Agent Skills](https://opencode.ai/docs/skills) · [Permissions](https://opencode.ai/docs/permissions) · [Config](https://opencode.ai/docs/config) · [MCP servers](https://opencode.ai/docs/mcp-servers)
- Schema (authoritative): [https://opencode.ai/config.json](https://opencode.ai/config.json) — `$defs.AgentConfig`, `PermissionConfig` (incl. `doom_loop`), `McpLocalConfig`/`McpRemoteConfig`, `experimental` (incl. `continue_loop_on_deny`, `primary_tools`, `mcp_timeout`), `compaction`, `snapshot`
- Repo: [github.com/anomalyco/opencode](https://github.com/anomalyco/opencode) (branch `dev`)
- Source files:
  - [`session/instruction.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/session/instruction.ts) — AGENTS.md/instructions loading
  - [`session/processor.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/session/processor.ts) — the agentic loop; `DOOM_LOOP_THRESHOLD = 3`, `permission.ask("doom_loop")`
  - [`agent/agent.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/agent/agent.ts) — agent `Info` schema (mode/topP/temperature/hidden/native…)
  - [`permission/index.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/permission/index.ts) — `evaluate()`, wildcard matching, default `ask`
  - [`tool/task.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/tool/task.ts) — subagent delegation, `subagent_depth`, background mode
  - [`tool/todo.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/tool/todo.ts) — `todowrite` tool + permission
  - [`tool/plan.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/tool/plan.ts) — `plan_exit` plan→build handoff
  - [`command/index.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/command/index.ts) — command registration (incl. skills/MCP as commands)
  - [`skill/index.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/skill/index.ts) — SKILL.md discovery + `skill` permission gating
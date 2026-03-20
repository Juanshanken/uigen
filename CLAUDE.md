# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup        # Install deps, generate Prisma client, run migrations
npm run dev          # Start dev server at localhost:3000 (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run all tests (Vitest)
npx vitest run src/path/to/__tests__/file.test.tsx  # Run a single test file
npm run db:reset     # Reset and re-migrate the SQLite database
```

All dev/build/start scripts must use `NODE_OPTIONS='--require ./node-compat.cjs'` — this is already baked into the npm scripts. The `node-compat.cjs` file removes `globalThis.localStorage/sessionStorage` to fix Node 25+ SSR compatibility with the Web Storage API.

The `ANTHROPIC_API_KEY` in `.env` is optional. Without it, a `MockLanguageModel` returns static demo components instead of calling Claude.

## Architecture

UIGen is an AI-powered React component generator. Users describe components in a chat; Claude generates code using tool calls; the result is previewed live in an iframe — all without writing files to disk.

### Key Data Flow

1. User submits a prompt in `ChatInterface`
2. `ChatProvider` (`src/lib/contexts/chat-context.tsx`) serializes the current `VirtualFileSystem` and sends it with messages to `POST /api/chat`
3. `/api/chat/route.ts` streams a Claude response (via Vercel AI SDK) with two tools available: `str_replace_editor` and `file_manager`
4. Tool calls come back as stream events; `ChatProvider` applies them to the `VirtualFileSystem` held in `FileSystemContext`
5. `PreviewFrame` reads the updated VFS, runs files through `jsx-transformer.ts` (Babel standalone), and renders the result in an iframe using a blob URL
6. On finish, if the user is authenticated, the project (messages + VFS) is saved to SQLite via Prisma

### Core Modules

- **`src/lib/file-system.ts`** — `VirtualFileSystem`: in-memory file tree, serializable to JSON for Prisma storage. Used by AI tools and the preview.
- **`src/lib/transform/jsx-transformer.ts`** — Babel-transforms JSX files to browser-executable ES modules; creates an import map pointing to esm.sh for React and other packages. Generates the full HTML blob rendered in the iframe.
- **`src/lib/provider.ts`** — Selects Claude Haiku (real) or `MockLanguageModel` (demo) based on `ANTHROPIC_API_KEY`.
- **`src/lib/prompts/generation.tsx`** — System prompt for Claude: always produce `/App.jsx` as entry point, use Tailwind, manipulate files via tools.
- **`src/lib/tools/`** — `str_replace_editor` and `file_manager` tool definitions given to Claude.
- **`src/lib/auth.ts`** — JWT sessions (jose), 7-day expiration, `auth-token` httpOnly cookie.
- **`src/lib/contexts/`** — `FileSystemContext` manages VFS state; `ChatContext` wraps Vercel AI SDK's `useChat`.

### Routing & Auth

| Route | Notes |
|---|---|
| `/` | Redirects authenticated users to their first project; anonymous users get a fresh `MainContent` |
| `/[projectId]` | Protected — requires a valid session |
| `/api/chat` | Streams AI responses; saves project state on finish if authenticated |
| `/api/projects/*`, `/api/filesystem/*` | Protected by `src/middleware.ts` |

Server actions in `src/actions/` handle auth (`signUp`, `signIn`, `signOut`, `getUser`) and project CRUD. All use `server-only` to prevent client-side imports.

### Database

Prisma + SQLite (`prisma/dev.db`). Two models:
- `User` — email/bcrypt-hashed password
- `Project` — `messages` (JSON string) and `data` (JSON string of the serialized VFS), associated with an optional `User`

### Testing

Tests live in `__tests__/` subdirectories next to the code they test. Vitest runs in a jsdom environment. Run a single file with `npx vitest run <path>`.

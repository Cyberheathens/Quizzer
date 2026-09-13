# Contributing to Engage

Thanks for helping improve Engage. Contributions are welcome from first-time
contributors and experienced maintainers alike.

## Development setup

You need Node.js 20 or newer and npm.

```bash
git clone https://github.com/Cyberheathens/Quizzer.git
cd Quizzer
npm ci
cp .env.example .env
npm run db:init
```

Add Neon and Pusher credentials to `.env`, then run the API and frontend in
separate terminals:

```bash
npm run dev:server
npm run dev
```

The frontend runs at `http://localhost:5173` and proxies `/api` requests to the
local API at `http://localhost:3001`.

## Making a change

1. Create a focused branch from `main`.
2. Keep database changes backward-compatible. Add new schema statements to both
   `api/_db.cjs` and `scripts/init-db.mjs`.
3. Keep Neon Postgres as the source of truth. Realtime events should accelerate
   updates, while the state endpoint remains a reliable fallback.
4. Add or update tests for behavior that can run without production credentials.
5. Run the complete verification suite before opening a pull request.

```bash
npm run verify
```

For database or realtime changes, also run an isolated local API test. Never
commit `.env` files, production credentials, or permanent test fixtures.

## Code conventions

- Use TypeScript for frontend code and ESM JavaScript for serverless handlers.
- Keep shared server-only helpers in explicit `.cjs` files so Vercel does not
  mistake them for standalone functions.
- Prefer small, accessible components with visible focus and disabled states.
- Validate participant input on the server even when the UI validates it too.
- Preserve the existing room state and poll lifecycle contracts.

## Pull requests

A useful pull request includes:

- a concise explanation of the problem and solution;
- screenshots or a short recording for visible interface changes;
- notes about schema or environment-variable changes;
- verification steps and their results;
- linked issues where applicable.

Please keep unrelated refactors out of feature or bug-fix pull requests. CI must
pass before review.

## Commit messages

Use an imperative subject that explains the outcome, for example:

```text
Add moderated realtime word clouds
Fix room code password mismatch
```

## Reporting security issues

Do not disclose exploitable vulnerabilities in a public issue. Contact the
Cyberheathens maintainers privately with reproduction steps and affected
versions.

## License

By contributing, you agree that your contributions will be licensed under the
repository's [MIT License](LICENSE).

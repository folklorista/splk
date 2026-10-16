---
name: deploy
description: Deploy a version of the SPLK app to production (https://moje.vonica.cz over SFTP) – check what production runs now, prepare and run database migrations (once a backend exists), upload changed files, verify the result on the production URL and report. Use when the user runs /deploy [version|commit|branch|working] or asks to "nasadit", "nasaď", "deploy" the app to production.
argument-hint: "[tag | commit | branch | working]"
---

# Deploy to production

Talk to the user in Czech. All deploy logic lives in `scripts/deploy.mjs` (run via `npm run deploy -- …`);
this skill orchestrates it. Configuration and credentials are in the git-ignored `.env` (template `.env.example`) –
never print passwords from it.

## 1. Preconditions

- `.env` exists and `node_modules/` exists in the repo root (else `npm install`) and in `frontend/` (else `npm run frontend:install`).
- Run the long commands below with a 10-minute timeout (the build takes a few minutes).

## 2. What runs on production now

```bash
npm run deploy -- --status
```

Prints the version tag, revision (`branch@commit[+dirty]`) and build time read from the `<meta>` tags of the
production `index.html`. Remember the production commit for the change list in step 4.

## 3. What to deploy – map the argument (`$ARGUMENTS`) to script options

| Argument | Options | Meaning |
|---|---|---|
| (none) | `--source tag` | latest `v*` tag reachable from `master` |
| `working` (also „rozpracované“, „necommitnuté“) | `--source working` | working copy incl. uncommitted changes (build marked dirty) |
| anything else, e.g. `v1.0`, `v2026.10.3`, `a1b2c3d`, `feature/x` | `--ref <argument>` | a tag (or unique tag prefix), commit or branch, built in a clean temporary worktree |

If the argument does not resolve (the script fails with "Unknown --ref" or "matches several tags"), stop and
list the candidates (`git tag --sort=-creatordate | head`, `git branch`). Never create tags, versions or
changelog entries yourself – the user does the versioning.

Add `--demo` while the app has no backend: production runs the demo build with real (masked) members from
`dev/local/clenove.tsv` behind Basic Auth. Drop `--demo` only after the user says production runs the backend.

## 4. Change list and migrations

1. Changes between production and the target: `git log --oneline <production commit>..<target>` (for `working`
   also `git status --short`). If production has no build info, say so and skip the list.
2. **Migrations.** There is no backend or database yet. If `backend/migrations/` does not exist, report
   „migrace: žádné (backend zatím není)“ and continue. Once the backend exists (Phase 5), this step is to be
   designed together with the user: versioned SQL files in `backend/migrations/`, a `schema_migrations` table
   on production, a migration prepared for every source incl. uncommitted changes, run on the production
   DB after upload, with DB credentials in `.env`. Until then, do not invent a mechanism – stop and ask if
   `backend/migrations/` shows up without a documented procedure here.

## 5. Dry run and the single confirmation

```bash
npm run deploy -- <options> --demo --dry-run
```

Builds the target and compares it with the server without uploading anything. Then show the user a short summary
and **wait for one explicit „ano“** before continuing:

- production now → version to deploy (tag / revision, dirty warning for `working`)
- change list (step 4) and migrations
- files: to upload / unchanged / stale to delete (from the dry-run summary), Basic Auth yes/no

## 6. Deploy

```bash
npm run deploy -- <options> --demo --yes
```

It rebuilds the target, uploads `.htpasswd` + `.htaccess` first, then only changed files (content-hashed chunks
already on the server are skipped; `index.html` and `ngsw.json` go last), deletes stale files and verifies that
the production `index.html` reports the new revision (and 401 without password). If it fails midway, report
exactly which step failed and the output – do not retry blindly and do not deploy an older version without asking.

## 7. Verify on the production URL

Credentials from `.env` (`SITE_URL`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD`) – load them with node without
echoing them (`source .env` breaks on values containing `#`):

```bash
node -e 'process.loadEnvFile(".env"); const e=process.env, h={Authorization:"Basic "+Buffer.from(e.BASIC_AUTH_USER+":"+e.BASIC_AUTH_PASSWORD).toString("base64")};
(async()=>{for (const p of ["/", "/app/dashboard", "/app/costumes", "/build-info.json"]) {
  const r=await fetch(e.SITE_URL+p,{headers:h}); console.log(p, r.status, p.endsWith(".json")? await r.text() : "");
} console.log("no auth", (await fetch(e.SITE_URL+"/")).status);})()'
npm run deploy -- --status
```

Expect 200 for all paths (deep routes prove the SPA fallback), 401 without auth, and `build-info.json` / `--status`
matching the deployed revision.

## 8. Report

Short report in Czech: previous → new version (tag/revision), number of uploaded/deleted files, migrations,
verification results (URL, 401/200 checks), anything that failed or was skipped. Mention that users get the new
version after the service worker update (reload of the app).

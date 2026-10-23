# Site Express server storage

The API uses a local SQLite file while running on Node. Set `SITE_EXPRESS_DB_PATH` to an absolute path on a persistent volume before using that mode for real data. The default `/tmp/site-express-pro.sqlite` is only for local development; `/tmp` can be erased when a machine or container restarts.

The current Lovable build targets Cloudflare Workers. Workers do not support `node:sqlite` or a writable local filesystem. On Cloudflare, the API selects a D1 database binding named **`SITE_EXPRESS_DB`** from `request.runtime.cloudflare.env`. If that binding is missing, auth and workspace writes return HTTP 503 with a configuration error. It does not silently write to temporary storage.

To enable persistent accounts and projects on a Cloudflare deployment, create a D1 database in the hosting account, bind it to the Worker as `SITE_EXPRESS_DB`, then deploy with that binding. A Wrangler configuration uses `d1_databases` with `binding`, `database_name`, and the actual `database_id` supplied by Cloudflare. The generated `.output/server/wrangler.json` is overwritten by each build, so configure the binding in the deployment's persistent source configuration. The runtime creates the tables on first use. No database ID or account credentials are included in this repository.

The D1 adapter has automated tests against a transactional SQLite stand-in, but no live D1 binding was available here. Confirm the deployed worker with a real register → session → workspace save → workspace read → logout flow before treating it as operational. If Lovable's deployment path cannot accept a D1 binding, the current auth/workspace API cannot persist data there; use a hosting path that supports D1 or add an external database integration explicitly.

Public signup creates an `owner` of a new, separate organization. Clients never choose a role or organization ID. Each workspace query derives its organization ID from the session. Published site reads expose only the explicitly stored `publicData` projection; do not put secrets into that field.

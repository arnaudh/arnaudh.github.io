
What this bundle contains:
- `.github/workflows/camunisport-refresh-pages.yml`: scheduled + manual GitHub Action
- `camunisport/index.html`: static frontend
- `camunisport/fetch_availability.py`: server-side fetch script run by Actions
- `camunisport/availability.json`: initial placeholder that will be overwritten on deploy

Behavior:
- The workflow runs on a schedule and on manual trigger.
- It refreshes `camunisport/availability.json`.
- It deploys to GitHub Pages directly from artifact (no git commit needed for data updates).
- Manual runs support `dry_run=true` to test refresh without deploying.

Set these repository secrets in `arnaudh.github.io`:
- `CAM_UNI_SPORTS_USERNAME` (optional)
- `CAM_UNI_SPORTS_PASSWORD` (optional)

Notes:
- If credentials are not required by the upstream API, you can leave them unset.
- If refresh fails, deployment fails and the previously deployed Pages version remains live.

Deploy/test checklist:
1. Commit and push `.github/workflows/camunisport-refresh-pages.yml`, `camunisport/index.html`, `camunisport/fetch_availability.py`, and this README.
2. In GitHub Pages settings, set source to **GitHub Actions** (required for `deploy-pages`).
3. Trigger a dry run:
   - `gh workflow run "CamUniSport Refresh And Deploy" -f dry_run=true`
   - `gh run list --workflow "CamUniSport Refresh And Deploy" --limit 1`
   - `gh run watch <run-id>`
4. Trigger a real deploy:
   - `gh workflow run "CamUniSport Refresh And Deploy" -f dry_run=false`
   - `gh run list --workflow "CamUniSport Refresh And Deploy" --limit 1`
   - `gh run watch <run-id>`

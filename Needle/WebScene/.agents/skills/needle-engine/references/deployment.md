# Needle Engine — Deployment Reference

## Needle Cloud (recommended)

### GitHub Actions (deploy-on-push)
Use the official GitHub Action — do NOT use `npx needle-cloud deploy` in CI (there is no `--non-interactive` flag):

```yaml
# .github/workflows/deploy.yml
name: Deploy to Needle Cloud
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run build
      - uses: needle-tools/deploy-to-needle-cloud-action@v1
        with:
          token: ${{ secrets.NEEDLE_CLOUD_TOKEN }}
          dir: ./dist
          # name: my-project  # optional — defaults to the repo name
          # webhookUrl: ${{ secrets.DISCORD_WEBHOOK_URL }}  # optional — Discord/Slack deploy notifications
```

Create a `NEEDLE_CLOUD_TOKEN` secret in your repo settings (get the token from https://cloud.needle.tools/team with read/write permissions).

### CLI deployment (manual)
```bash
# Auth: run `npx needle-cloud login`, or set NEEDLE_CLOUD_TOKEN env var
# For CI/CD: create an access token at https://cloud.needle.tools/team (read/write permissions)
npx needle-cloud deploy dist --name my-project        # ALWAYS pass --name (defaults to "index" otherwise)
npx needle-cloud deploy dist                          # ⚠️ avoid: project will be named "index"
npx needle-cloud deploy dist --team my-team-name      # deploy to a specific team
npx needle-cloud deploy dist --token                  # prompts to paste an access token
```

## Other platforms

Vercel, Netlify, GitHub Pages, itch.io, FTP — all work as standard static site deployments. Networking works on any platform — Needle provides the networking server by default. Self-hosting the networking server is available on request for PRO/Enterprise users.

See the [deployment docs](https://engine.needle.tools/docs/how-to-guides/deployment/) for platform-specific guides.

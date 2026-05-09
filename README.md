# urcooked.lol

Terminal-native GitHub roast tool. `curl urcooked.lol/<username>` and your GitHub gets brutally and specifically roasted by AI, streamed line by line. Get a shareable link at the end.

```
$ curl urcooked.lol/torvalds
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ur cooked, torvalds
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

started linux. peaked in 1991.
[...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  share your roast → urcooked.lol/r/xk92p
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## stack

- node 20 + express
- openai (gpt-5.4-mini by default, configurable)
- github rest api v3
- sqlite via better-sqlite3
- helmet on browser routes only (CSP would break the curl streaming)
- nanoid for short share IDs

## local dev

```bash
cp .env.example .env
# fill in OPENAI_API_KEY and optionally GITHUB_TOKEN
npm install
npm run dev
```

Then:

```bash
curl localhost:3000/torvalds
open http://localhost:3000
```

Or use docker:

```bash
docker compose up --build
```

## deploy to railway

1. Push this repo to GitHub.
2. New project on Railway, deploy from GitHub repo.
3. Railway will detect the `Dockerfile` and build it.
4. **Add a Volume**: in your service settings, attach a Volume mounted at `/app/db`. Without this, the SQLite file resets on every redeploy and all share links die.
5. Add env vars in Railway:
   - `OPENAI_API_KEY` (required)
   - `GITHUB_TOKEN` (optional, but get one — bumps rate limit 60→5000/hr)
   - `BASE_URL` (set to your Railway URL or custom domain, e.g. `https://urcooked.lol`)
   - `OPENAI_MODEL` (optional override)
   - `NODE_ENV=production`
6. Railway sets `PORT` automatically. Don't override.
7. Health check is configured in `railway.json` to hit `/health`.
8. Point your domain at the Railway service (Settings → Networking → Custom Domain).

### domain setup

Buy `urcooked.lol` (Namecheap, Porkbun, whatever). In Railway:
- Settings → Networking → Custom Domain → add `urcooked.lol`
- Copy the CNAME target Railway gives you
- Add a CNAME record at your registrar pointing the apex (or use ALIAS/ANAME if your registrar supports it; Namecheap doesn't, so use `www.urcooked.lol` and redirect, or use Cloudflare in front)

## endpoints

| route | what it does |
|-------|--------------|
| `GET /` | landing page with fake terminal demo and username form |
| `GET /:username` | the roast. curl streams ANSI, browser redirects to /r/:id |
| `GET /r/:id` | share page. curl gets the same ANSI roast, browser gets a styled page |
| `GET /health` | returns `ok`, used by Railway healthcheck |

## how the curl detection works

`src/utils/detectCurl.js` checks the User-Agent header. If it contains `curl`, `wget`, `httpie`, `http/`, `powershell`, or `fetch/`, we treat the client as a terminal and stream ANSI plain text. Otherwise it's a browser and gets HTML.

## caching

If the same username is roasted twice within 1 hour, the second request returns the cached roast instantly. Saves OpenAI cost and makes refreshing the share page snappy. TTL lives in `src/routes/roast.js` as `CACHE_TTL_MS`.

## rate limits

5 requests/minute per IP for `/:username`. Configurable in `src/routes/roast.js`. The share endpoint is not rate limited because it's just DB reads.

## tweaking the roast

The system prompt is in `src/services/openai.js`. The data the model sees is in `src/services/github.js` — `fetchGithubProfile` builds the structured payload. Add or remove fields there to tune what the roast notices.

## file map

```
src/
├── index.js              # express setup, routes wiring, graceful shutdown
├── routes/
│   ├── roast.js          # GET /:username with rate limit, curl streaming, browser redirect
│   └── share.js          # GET /r/:id with curl ANSI replay or styled HTML
├── services/
│   ├── github.js         # fetches profile + repos, derives stats for the prompt
│   ├── openai.js         # streaming + non-streaming roast generation
│   └── db.js             # sqlite setup, save/get/findRecentByUsername
├── utils/
│   ├── ansi.js           # color helpers, header/footer/error banners
│   ├── detectCurl.js     # UA-based terminal client detection
│   ├── shortId.js        # nanoid wrapper, 5-char lowercase
│   ├── template.js       # tiny mustache-ish templating with html escaping
│   └── validate.js       # github username regex + reserved path check
└── views/
    ├── index.html        # landing page
    ├── share.html        # /r/:id browser view
    └── not-found.html    # 404 page when github user doesnt exist
public/style.css          # all the styles
db/roasts.db              # sqlite (gitignored, persisted via volume)
Dockerfile
docker-compose.yml
railway.json
```

# Benny the Penny on iMessage (Photon Spectrum)

The ShamePool Squad Bot, reachable by text. It shares the **same brain** as the web app: every message goes to the app's `POST /api/ai/chat` route (Grok, English replies, validated actions), so there is one agent with two front doors.

## Behavior
- **Direct chat:** answers any question about the demo squad ("who's flaking?", "how close are we to pizza?"), with a typing indicator and read receipts.
- **Group chat:** stays quiet unless someone says its name (`Benny the Penny`, `Squad Bot`, `ShamePool`).
- **Money is never touched here:** if the brain proposes a penalty change, the agent tells the user to confirm it in the app.
- **Safety:** 8 messages/minute per sender, 400-character cap, 6-turn memory per chat (`reset` clears it), canned fallback if the app is down.
- **Limits:** text only (photo check-ins stay in the app) and it reads the shared **demo squad** (`src/demoContext.ts`), because the web app keeps real data in each browser until the live backend is on.

## Two ways to run it
1. **Vercel (webhooks, no server to babysit):** `api/spectrum-webhook.ts` is a Vercel Function. Photon POSTs each inbound message (HMAC-signed) to it, and the function replies through the same agent. Live at `https://photonbot-ten.vercel.app/api/spectrum-webhook` (open it in a browser for a health check).
2. **Long-running process (`bun start`):** keeps a streaming connection to Photon. Handy locally. **Do not run both at once**: with a webhook registered you would answer every message twice.

### Deploy the webhook version
```sh
vercel link --project photonbot
# env (production): PROJECT_ID, PROJECT_SECRET, SHAMEPOOL_URL, AGENT_API_KEY, SPECTRUM_WEBHOOK_SECRET
vercel deploy --prod
# register the URL once; the response contains the signing secret (shown only once) -> SPECTRUM_WEBHOOK_SECRET
curl -X POST "https://spectrum.photon.codes/projects/$PROJECT_ID/webhooks/" -u "$PROJECT_ID:$PROJECT_SECRET"   -H "Content-Type: application/json" -d '{"webhookUrl":"https://<your-app>.vercel.app/api/spectrum-webhook"}'
```
Notes: the handler runs after the HTTP response, so the function uses `waitUntil`; deliveries are at-least-once, so repeated message ids are skipped; chat memory is per warm instance (best effort) because serverless keeps no state.

## Run locally
```sh
cp .env.example .env     # PROJECT_ID, PROJECT_SECRET from the Photon dashboard
bun install
bun start                # iMessage line
SPECTRUM_TERMINAL=1 bun start   # also chat from the terminal, no phone needed
bun test                 # 12 unit tests (no network)
bun src/live-check.ts    # asks the real brain a few questions
```
To text the line, add a phone number to your Photon account (avatar menu) so Spectrum can enroll you on the project.

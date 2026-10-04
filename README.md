# Flakey on iMessage (Photon Spectrum)

The ShamePool Squad Bot, reachable by text. It shares the **same brain** as the web app: every message goes to the app's `POST /api/ai/chat` route (Grok, English replies, validated actions), so there is one agent with two front doors.

## Behavior
- **Direct chat:** answers any question about the demo squad ("who's flaking?", "how close are we to pizza?"), with a typing indicator and read receipts.
- **Group chat:** stays quiet unless someone says its name (`Flakey`, `Squad Bot`, `ShamePool`).
- **Money is never touched here:** if the brain proposes a penalty change, the agent tells the user to confirm it in the app.
- **Safety:** 8 messages/minute per sender, 400-character cap, 6-turn memory per chat (`reset` clears it), canned fallback if the app is down.
- **Limits:** text only (photo check-ins stay in the app) and it reads the shared **demo squad** (`src/demoContext.ts`), because the web app keeps real data in each browser until the live backend is on.

## Run
```sh
cp .env.example .env     # PROJECT_ID, PROJECT_SECRET from the Photon dashboard
bun install
bun start                # iMessage line
SPECTRUM_TERMINAL=1 bun start   # also chat from the terminal, no phone needed
bun test                 # 12 unit tests (no network)
bun src/live-check.ts    # asks the real brain a few questions
```
To text the line, add a phone number to your Photon account (avatar menu) so Spectrum can enroll you on the project.

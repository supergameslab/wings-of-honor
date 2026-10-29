# Wings of Honor — playable prototype

A browser-first, 3D arcade WWII flight-combat game. Tagline: **Fly. Fight. Win.** It uses the same Three.js + Vite + Cloudflare engine as Sopwith: Iron Skies, with WWII aircraft, theatres, and missions.

> This is a playable prototype foundation, not a finished commercial game. Aircraft, terrain, clouds, explosions, enemy AI, touch controls and UI are procedurally built or generated locally.

Live: [supergameslab.com/wings-of-honor](https://supergameslab.com/wings-of-honor/)

## Run locally in the browser

Requirements: Node.js 18 or newer and npm.

```bash
npm install
npm run dev
```

Open the URL Vite prints, usually **http://localhost:5173/wings-of-honor/**. That local server runs:

- the game at **http://localhost:5173/wings-of-honor/**
- the Cloudflare Worker API at `/wings-of-honor/api/*`

Desktop controls: **WASD / arrow keys** to fly, **Space** to fire, **B** to drop a bomb, **Esc** to pause. On touchscreens use the left virtual stick and FIRE/BOMB buttons.

To test the production build locally:

```bash
npm run preview
```

## What’s in this build

- Six flyable WWII aircraft with distinct handling: Spitfire, P-40, Stuka, Bf 109, P-51, Hellcat
- 100 campaign missions across five theatres: Battle of Britain, Desert Storm, Fortress Europe, Pacific Thunder, Final Offensive
- Cadet / Pilot / Ace difficulty, hangar unlocks, medals, Quick Mission, Hunt / Duel / Squadron
- Chase and cockpit cameras, bombs, flak, convoys, carrier and island sectors

## Project structure

```text
├── index.html              # Game shell
├── src/                    # Client: flight, AI, campaign, world, HUD
├── worker/                 # Cloudflare Worker API
└── public/assets/          # Title art and icons
```

This project uses generated/procedural placeholder art and is not affiliated with any air force or aircraft manufacturer.

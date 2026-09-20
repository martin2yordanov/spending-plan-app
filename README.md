# Spending Plan

A personal budgeting app: income, expenses by category, savings goals, an
emergency-fund target, a financial health score, an exportable report and an
optional AI advisor. It runs on the web and, through Capacitor, as a native iOS
app from the same source.

## Scripts

| | |
|---|---|
| `npm install` | install dependencies |
| `npm run dev` | Vite dev server, proxying `/api` to `npm run server` |
| `npm run server` | the local API on :3001 (see **Local API** below) |
| `npm test` | the test suite |
| `npm run build` | production build into `dist/` |
| `npm run preview` | serve that build |
| `npm start` | build output served by `server.js` in production mode |
| `npm run ios:sync` | build and sync into the iOS project |
| `npm run ios:open` | open it in Xcode |

## Where the data lives

Signed out, the app shows example figures and saves nothing.

Signed in (Clerk), the plan is stored twice: on the device, and against your
account on the server. The device copy is what the app paints from at launch
and what keeps it working with no connection; the server copy is what brings it
to your other devices. Both carry a timestamp, and the newer one wins. An edit
made offline is marked pending and pushed when the connection or the app comes
back.

## Local API

`server.js` stands in for the Vercel functions in `api/` during development. It
is deliberately not equivalent to them — it stores plans as files under `data/`
rather than in Redis, and it does not verify Clerk sessions or rate limit
anything. It is for `localhost`, not for the internet; `api/` is what gets
deployed.

## Configuration

See `.env.example`. Nothing is required to run the app locally; the keys turn
on sign-in, the deployed API, the advisor and write authentication.

## Shipping to the App Store

See `IOS-RELEASE.md`, which covers generating the iOS project, the compliance
files, Sign in with Apple, the Clerk production instance and the data trap that
comes with switching to it.

# Shipping this to the App Store

Everything here needs a Mac with Xcode and the paid Apple Developer Program.
The web app is unaffected by any of it.

Bundle id is `bg.fathers.spendingplan` (`capacitor.config.json`). Change it
before the first upload if you want something else — after the first upload it
is permanent.

---

## 1. Generate the iOS project

```bash
npm install
npx cap add ios          # needs CocoaPods; Mac only
```

Then, once per build:

```bash
VITE_API_BASE_URL=https://spending-plan-app.vercel.app \
VITE_CLERK_PUBLISHABLE_KEY=pk_live_... \
npm run ios:sync

npm run ios:open         # opens Xcode
```

`VITE_API_BASE_URL` is **not optional for native builds**. The WebView runs at
`capacitor://localhost`, which has no `/api` of its own — leave it unset and the
app launches and then fails to load or save anything.

## 2. Copy in the compliance files

Both are templates because `cap add ios` generates the files they belong to.

- `ios-template/PrivacyInfo.xcprivacy` → `ios/App/App/PrivacyInfo.xcprivacy`
  Then drag it into the **App** group in Xcode and tick the **App** target.
  Present on disk but not added to the target means it is not bundled, and the
  upload is rejected for a missing manifest.
- `ios-template/Info.plist.additions` → merge each key into
  `ios/App/App/Info.plist`.

## 3. Icons and splash

`public/` has the web icons but Xcode needs its own asset catalogue.

```bash
npm install --save-dev @capacitor/assets
npx capacitor-assets generate --ios
```

It reads `assets/icon.png` (1024×1024, no transparency, no rounded corners —
iOS applies its own mask) and `assets/splash.png`. Create that folder from
`public/icon-512.png` upscaled, or better, re-export at 1024 from the source.
The splash background is already set to `#D6C9B9` in `capacitor.config.json`.

---

## 4. Sign in with Apple — guideline 4.8

**This is not optional.** The app offers Google sign-in through Clerk, and
guideline 4.8 requires Sign in with Apple to be offered alongside any
third-party login. Submitting without it is a rejection.

In the Apple Developer portal:

1. Certificates, Identifiers & Profiles → Identifiers → your App ID →
   enable **Sign In with Apple**.
2. In Xcode: App target → Signing & Capabilities → **+ Capability** →
   Sign In with Apple.
3. Keys → **+** → enable Sign in with Apple → download the `.p8`. Note the
   Key ID and your Team ID.

In the Clerk dashboard (production instance):

4. User & Authentication → Social Connections → enable **Apple**.
5. Paste the Services ID, Team ID, Key ID and the `.p8` contents.
6. Add the redirect URL Clerk shows you to the Apple key's Return URLs.

Clerk renders the Apple button automatically once the connection is on, so
`AuthBridge` needs no code change.

> Do not enable `limitsNavigationsToAppBoundDomains`. It restricts WebView
> navigation and is a good way to break the OAuth redirect this depends on.

---

## 5. Clerk production instance — and the data trap

The app is still on a **development** instance
(`pk_test_...`, `diverse-basilisk-2.clerk.accounts.dev`). Development instances
carry hard usage limits and are not supported for production, so this has to
change before release.

**Switching instances mints new user ids for the same email addresses.** Data is
stored against the Clerk user id, so every existing plan becomes unreachable the
moment you switch — exactly the failure that took a long time to diagnose once
already.

Do it in this order:

1. **Before switching**, note the current recovery key:
   `user_3FMIIqUN7JNWF5Dsbf3Ly1X0yRg`
2. Create the production instance in Clerk; configure Google **and** Apple on it.
3. Set `VITE_CLERK_PUBLISHABLE_KEY=pk_live_...` in Vercel **and** in the native
   build command.
4. Sign in to the new instance. The account will look empty — expected.
5. Bottom of the page → **Import data from another account** → paste the key
   from step 1. The dialog also shows your *new* id; keep it somewhere.

Also enable **self-service account deletion** in Clerk, or `user.delete()` is
rejected and the Delete-my-account flow fails — which is itself a guideline
5.1.1(v) rejection.

---

## 6. App Store Connect

- **Privacy nutrition labels** must match `PrivacyInfo.xcprivacy`: Financial
  Info, Email Address and User ID, each *linked to identity*, *not used for
  tracking*, purpose *App Functionality*.
- **Privacy policy URL**: `https://spending-plan-app.vercel.app/privacy.html`
- **Age rating**: the AI advisor produces financial commentary. Answer the
  questionnaire honestly; 4+ is fine, there is no gambling or mature content.
- **Review notes**: give the reviewer a test account, and say plainly that the
  app has no bank connection and every figure is entered by hand. Reviewers
  otherwise probe for a banking integration that does not exist.
- **Demo account**: sign-in is required to save anything, so a reviewer without
  credentials sees only example data. Provide a working account.

---

## 7. Guideline 4.2 — the real risk

Apple rejects apps that are only a website in a shell. What is now in place to
argue against that:

| Capability | Why it is not "just the website" |
|---|---|
| Works offline | Plan is cached on device; edits sync when the connection returns |
| Face ID lock | Biometric hardware, re-locks on backgrounding |
| Bill reminders | Local notifications scheduled from due dates |
| Native share sheet | Report goes through Files / Print / Messages |

If it is still rejected under 4.2, the strongest next additions are a **home
screen widget** (WidgetKit, shows safe-to-spend without opening the app) and
**App Intents** for "add an expense" by Siri. Both need Swift and a device to
test, which is why they are not here.

---

## 8. Known gaps

- **Writes now require a verified Clerk session — set `CLERK_SECRET_KEY` in
  Vercel to turn it on.** `api/data.js` checks that a POST/DELETE to a
  `user_*` id carries a session token for that exact id (Dashboard > API
  Keys > Secret key, **not** the publishable key already set). Until it is
  set, writes stay exactly as unauthenticated as before — this was done
  deliberately so shipping the code could not itself take down saving for the
  app's existing real users, but it also means the fix does nothing at all
  until this one step is done. Reads (`GET`) are intentionally still open for
  any id: "Import data from another account" reads an id that is by
  definition not the caller's own, the same knowledge-of-id model a
  pre-sign-in sync code already relies on.
- **Sync is last-write-wins by device clock.** Fine for one person's own
  devices; would need real conflict handling for a shared household plan.
- **Reminders fire on the due day**, not before, because "two days before the
  1st" lands in the previous month, whose length varies.
- **Redis password** may still be in Vercel's runtime logs from before the
  scrubbing fix. Rotate it.

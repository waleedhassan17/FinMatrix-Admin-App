# FinMatrix Admin

The FinMatrix **platform console** — the app the platform owner uses to approve
companies, review payment submissions, and watch revenue. It is a separate app
from FinMatrix itself, which is the product customers use to run their business.

Extracted from [FinMatrix](https://github.com/waleedhassan17/FinMatrix) at commit
`b8451e3`, where the console shipped inside the tenant bundle behind a
`user.role === 'super_admin'` branch.

| | |
|---|---|
| Platforms | Android, web |
| Package | `com.finmatrix.admin` |
| Deep link scheme | `finmatrixadmin://` |
| Expo SDK | 54 |

## Running it

```bash
npm install
npm run web          # fastest loop — no Gradle
npm run android      # device/emulator; needs the Android SDK
```

`android/` is **not** checked in. It is regenerated from `app.json` by
`npx expo prebuild --platform android --clean`, which `npm run android` does for
you. Change the package name, scheme, permissions or plugins in `app.json` — never
in `android/`, because the next prebuild overwrites it.

## Which API it talks to

`src/networks/network/apiHelpers.ts`:

```ts
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  'https://finmatrix-api-prod-665c6b5cb6a1.herokuapp.com/api/v1';
```

> **The default is production.** Approving or rejecting a payment submission there
> is a real, irreversible action against a real customer. Point somewhere else for
> anything destructive:
>
> ```bash
> EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1 npm run web
> EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api/v1 npm run android   # emulator
> ```

The backend is a separate NestJS repo. A web deployment of this console needs its
origin added to the backend's `CORS_ORIGINS`.

## Signing in

Sign-in posts to `/auth/signin` with `portal: 'admin'` — the door the server
admits both company owners and the platform console through. Because an owner's
credentials therefore succeed here, `SignInScreen` checks the resolved role and
rejects anything that is not `super_admin`, clearing the tokens before the user
reaches Redux. `NotAuthorizedScreen` catches the same case for a session restored
from disk. The server's `@Roles` guards remain the real boundary; both checks are
UX.

## Layout

```
src/
  screens/SuperAdmin/     the six console tabs + its Redux slice
  screens/Auth/           SignIn, ForgotPassword — the entire unauthenticated app
  navigators/             SuperAdminNavigator (tabs), BaseNavigator (signed out)
  components/admin/       AdminUI — the shapes the console repeats
  networks/               axios client, auth, /super-admin, /admin/payment-submissions
  theme/                  the design system; self-contained, no project imports
```

`src/components/app-container/AppContainer.tsx` is the shell: session bootstrap,
the signed-in/signed-out switch, deep linking, splash, toasts.

### Two things that will bite

- **The dashboard's quick actions navigate with `navigate('Companies' as any)`.**
  Six call sites, all cast through `any`, so renaming a tab in
  `SuperAdminNavigator` compiles cleanly and crashes at runtime. Don't rename the
  six tab route names; click every tile after touching that screen.
- **`src/types/index.ts` is inherited and mostly dead** — ~60 domain interfaces for
  invoices, payroll and the rest, kept because they are erased at build time and
  deleting them is churn. `RootStackParamList` at the bottom is the exception: it
  is the live navigation contract and is kept honest.

## Checks

```bash
npx tsc --noEmit      # hard gate
npm run check:tokens  # hard gate — bans hardcoded fontSize/fontWeight/hex colour
npx jest              # hard gate
npm run lint          # informational; the inherited codebase has pre-existing errors
```

CI (`.github/workflows/ci.yml`) runs all four on push and PR to `main`.

## Known drift

`expo@54.0.36` and `expo-file-system@19.0.23` are one patch behind what the SDK
expects (`npx expo install --check` reports it). Inherited from the source repo's
lockfile and left pinned so the console behaves identically to the app it was
extracted from. Bump deliberately, not incidentally.

`react-native-reanimated` and `react-native-worklets` are dependencies with no
imports. They are kept because dropping the package while leaving
`react-native-reanimated/plugin` in `babel.config.js` kills Metro at startup, and
nothing forces the removal.
# FinMatrix-Admin-App

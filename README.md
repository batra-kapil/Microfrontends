# Salesforce UI Embedding (Microfrontends) demo: Agenticwave SLA Tracker

An externally hosted React app embedded in a Lightning record page with the GA `lightning-ui-embedding` base component.

**Video tutorial:** [Salesforce Microfrontends (UI Embedding) on YouTube](https://www.youtube.com/watch?v=Oo04-n-SPOA)

A support agent opens a Case. Next to it, the **Agenticwave SLA Tracker** shows the case number, the priority, and a countdown to the response target (High 4 hours, Medium 8, Low 24). An **Escalate to High priority** button asks the page to raise the priority.

**Design rule:** the embedded app never updates Salesforce records. It sends an event, and the wrapper Lightning web component does the update with `updateRecord`.

Built and tested on a Summer '26 org (API 67.0) with `@salesforce/platform-sdk` 12.11.0.

## How it works

```
Case record page
└── caseSlaEmbed (wrapper LWC)
    └── lightning-ui-embedding  ── iframe ──>  React app (your HTTPS origin)
```

1. The wrapper reads the Case with `getRecord` and passes it to the app with `props={caseProps}`.
2. The app connects with `createViewSDK()` and reads `getUiState().state.props`. Later changes arrive through `getUiState().subscribe(...)`, so the widget updates when the record changes. No reload needed.
3. Escalate: the app dispatches a `CustomEvent("escalatecase")`. The wrapper catches it in the template with `onescalatecase={handleEscalate}`, runs `updateRecord`, and shows a toast. The record refreshes, new props flow to the app, and the widget shows High.
4. Opened directly in a browser (outside Salesforce), the app shows a standalone page instead.

## Project structure

| Path | What it is |
|---|---|
| `app/` | React + Vite app (the embedded widget) |
| `app/src/App.jsx` | Connects with the view SDK, reads props, sends `escalatecase` |
| `force-app/main/default/lwc/caseSlaEmbed/` | Wrapper LWC around `lightning-ui-embedding` |
| `force-app/main/default/cspTrustedSites/` | Trusted URL for the app's origin (`frame-src`) |
| `force-app/main/default/flexipages/` | Case record page with the widget in the right column |
| `force-app/main/default/objects/Case/` | Activates that page as the desktop default for Case |

## Requirements

- A Salesforce org that supports UI Embedding (Enterprise, Performance, Unlimited, Developer or Partner Developer edition, on Hyperforce, English as the default language).
- Salesforce CLI (`sf`).
- Node.js 20.19+ or 22.12+ (Vite 8). The app pins Node 22 in `app/.nvmrc`.
- A static host that gives the app its own HTTPS origin and does not send `X-Frame-Options` or a restrictive `frame-ancestors` header.

## Setup

### 1. Build and host the app

```bash
cd app
npm install
npm run build
```

Deploy `app/dist` to your host. Then check the live URL:

```bash
curl -sI https://your-app.example.com/
```

You want `200`, no redirect to another origin, and no `X-Frame-Options` or `Content-Security-Policy: frame-ancestors` header.

On Netlify, new "Drop" sites can start as team-only. Visitors then get a `401` and a login redirect, which breaks the embed. Make the site public.

### 2. Point the Salesforce side at your origin

Replace `https://lambent-nasturtium-fc6c74.netlify.app` with your app's origin in two files:

- `force-app/main/default/lwc/caseSlaEmbed/caseSlaEmbed.js` (`appUrl`)
- `force-app/main/default/cspTrustedSites/Agenticwave_SLA.cspTrustedSite-meta.xml` (`endpointUrl`)

An origin is the scheme plus the host, for example `https://your-app.example.com`, with no path. It must match exactly.

### 3. Deploy

```bash
sf project deploy start --target-org <your-alias> \
  --source-dir force-app/main/default/cspTrustedSites \
  --source-dir force-app/main/default/lwc/caseSlaEmbed \
  --source-dir force-app/main/default/flexipages \
  --source-dir force-app/main/default/objects/Case
```

This adds the Trusted URL, the wrapper, the Case page, and activates the page as the desktop default for Case. To place the component on your own page instead, skip the last two folders and drag **Agenticwave SLA Tracker** onto a Case page in Lightning App Builder.

### 4. Try it

Create a new Case (a fresh created date gives a meaningful countdown), open it, and click **Escalate to High priority**. Then edit Priority on the record and watch the widget follow.

## Things we learned by running it

- **Use `title`, not `shell-title`.** `title` becomes the iframe's accessible name. `shell-title` compiles but has no effect.
- **Listen for errors early.** Configuration errors such as `SAME_ORIGIN_SRC` fire before `renderedCallback`. The wrapper registers its `sf-embedding.component.error` listener in the constructor on `this.template` with capture `true`.
- **Dotted event names need `addEventListener`.** `sf-embedding.component.ready` and `.error` cannot be bound in the template. Simple lowercase names from your app (like `escalatecase`) can.
- **Only `CustomEvent`s leave the iframe.** In the view SDK, a plain `new Event()` stays local.
- **Import `@salesforce/platform-sdk/ui-embedding` even though you use nothing from it.** It starts the session with the host.
- **Height is automatic.** The host sets the iframe height. Avoid `100vh` (Vite's default CSS uses `100svh`).
- **`props` can change after mount. `src` cannot.** Changing `src` gives `SESSION_BINDING_MUTATED`.
- **`sandbox` tokens are added to the defaults.** `sandbox="allow-popups"` gave `allow-scripts allow-same-origin allow-popups`.
- **The iframe is transparent.** Set a background in the app if you want it to match the page.
- **Lightning caches components in the browser.** While developing, turn off Setup, Session Settings, "Enable secure and persistent browser caching to improve performance".

## Error reference (as observed)

| Cause | phase | code | retryable |
|---|---|---|---|
| Trusted URL missing or inactive | bootstrap | `HEARTBEAT_TIMEOUT` (after 30 s, area stays blank until then) | true |
| `src` uses the org's own Lightning origin | configuration | `SAME_ORIGIN_SRC` | false |
| `src` changed after mount | configuration | `SESSION_BINDING_MUTATED` | false |

## Docs

- [Get started](https://developer.salesforce.com/docs/platform/microfrontend/guide/get-started.html)
- [Exchange data](https://developer.salesforce.com/docs/platform/microfrontend/guide/exchange-data.html)
- [Resize the embedded app](https://developer.salesforce.com/docs/platform/microfrontend/guide/resize-embedded-app.html)
- [Error codes](https://developer.salesforce.com/docs/platform/microfrontend/references/microfrontend-error-codes/error-codes.html)
- [Migrate from Developer Preview](https://developer.salesforce.com/docs/platform/microfrontend/guide/migrate-from-dev-preview.html)

## License

MIT. See [LICENSE](LICENSE).

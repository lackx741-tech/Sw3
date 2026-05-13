# Sw3

## Dashboard integration builder

The `apps/dashboard` app now includes an advanced integration dashboard for
end-to-end SW3 embedding:

1. Select the modal/tool flow (Sweep Modal, Wallet Button, Transaction Status).
2. Select the target chain + contract (or provide a custom contract address).
3. Validate backend integration status (API gateway, sweeps, tokens services).
4. Compile and generate:
   - embeddable `Script.js` URL
   - full generated script source
   - website embed snippet

### Run dashboard locally

```bash
pnpm --filter @sw3/dashboard dev
```

Open `http://localhost:3000`.

### Embed on any website

Use the generated snippet from the dashboard output section, which follows this
pattern:

```html
<script src="https://<your-dashboard-host>/api/integration/script.js?..."></script>
<div id="sw3-embed-root" data-sw3-embed></div>
<script>
  window.addEventListener("DOMContentLoaded", function () {
    window.SW3Embed?.mount?.("#sw3-embed-root");
  });
</script>
```

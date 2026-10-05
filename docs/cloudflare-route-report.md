# Cloudflare OPDS route — actual evidence

Date: **2026-10-05**, external probes **08:07–08:08 UTC / 10:07–10:08 Europe/Warsaw**.
Scope: approved hostname route and DNS only (OPS-002, AUTH-001, COST-001).
Application installation/startup and FBReader acceptance remain pending.

## Read-only preflight

- Account: `84fa2e65e913d7433de42358796b1174`.
- Zone: `ysilvestrov-ai.uk`, ID `52c1c822422dfbb645ed7b255c2d574f`, active,
  actual plan **Free Website**.
- Existing remotely managed tunnel: `hetzner-vps`, ID
  `9e16aabf-1cad-43e1-9546-d9e72ee0c7fb`, **healthy**.
- Configuration version 3: `code.ysilvestrov-ai.uk` → `http://127.0.0.1:8080`,
  `beer-api.ysilvestrov-ai.uk` → `http://localhost:3000`, final `http_status:404`.
- No OPDS ingress, exact-name DNS record, wildcard DNS record or account Access
  application. No global originRequest settings.
- Current Cloudflare documentation confirms Tunnel is available on all plans;
  its connectivity is free. No plan/subscription or paid add-on was changed.
  Sources: [Tunnel](https://developers.cloudflare.com/tunnel/),
  [Free tunnels](https://blog.cloudflare.com/tunnel-for-everyone/).

## Changes and API readback

Re-read configuration version and DNS immediately before mutation; required
version 3 and no collision. Added exactly one ingress before the final 404:

```text
opds.ysilvestrov-ai.uk → http://127.0.0.1:8787
```

No path restriction; originRequest defaults. Configuration became version **4**.
Readback compared the entire configuration with only the OPDS rule removed
against the pre-change configuration: **identical**. Both existing routes,
their order/settings and catch-all were preserved.

Created and independently read back:

| DNS field | Actual value |
|---|---|
| Record ID | `de7a87f0af5723abc52a2d6e6471ca2e` |
| Name | `opds.ysilvestrov-ai.uk` |
| Type | CNAME |
| Target | `9e16aabf-1cad-43e1-9546-d9e72ee0c7fb.cfargotunnel.com` |
| Proxied | true |
| TTL | automatic (create request: 1) |

Final API checks: successful, tunnel healthy, zone still **Free Website**.
No Access application, WAF/BIC exception, TLS change, Workers/R2 resource,
new tunnel, tunnel token or host change was created.

## External checks and their limits

- DNS resolved to Cloudflare proxy addresses `104.21.33.116`, `172.67.162.84`.
- Python urllib GET to both OPDS `/opds` and existing beer-api `/health` received
  HTTP 403, `Server: cloudflare`, body `error code: 1010`, no Basic challenge.
  Cloudflare documents 1010 as browser-signature blocking; this result does not
  establish origin health. No security setting or client signature was changed.
  [Error 1010](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/).
- Actual in-app browser navigation to OPDS displayed **502 Bad gateway** with
  Browser/Cloudflare Working and Host Error (08:08:17 UTC). The previous server
  report says OPDS was not installed/listening; 502 is consistent with that,
  but local origin state was not independently checked in this step.
- Browser navigation to beer-api health was blocked by the browser client
  (`ERR_BLOCKED_BY_CLIENT`). Fresh bot HTTP health therefore remains unverified
  here; preservation of its tunnel configuration was verified by full readback.

This proves DNS/tunnel configuration, not application readiness. Require local
exact-SHA `/health`, external 401/Basic challenge and authenticated XML after
operator installation. FBReader compatibility and any edge blocking of its
actual client remain pending. Do not disable zone-wide protection to infer a pass.

## Operator continuation and rollback

Continue `docs/codex-cli-prototype-continuation.md`. The Cloudflare route step is
done: inspect the existing mapping rather than create it again. Host bootstrap,
immutable artifact installation, root-only credentials and manual prototype
startup still require the operator. Production/timer remain off.

If rollback of this route is needed, first re-read current configuration and DNS.
Delete only the DNS record above after checking its name/type/target; remove only
the exact OPDS ingress with the recorded origin from the **current** configuration.
Preserve every other rule and setting, including any later operator changes.
Do not restore the entire old version-3 configuration. Verify readback afterwards.
Rollback has not been executed.

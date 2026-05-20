# Certbot Renewal Validation

Date: 2026-04-30

## Scope

This document records the renewal validation result for the SSAfer service certificate.

The SSAfer NGINX container uses:

```text
/etc/letsencrypt/live/<LEGACY_DEPLOY_DOMAIN>/fullchain.pem
/etc/letsencrypt/live/<LEGACY_DEPLOY_DOMAIN>/privkey.pem
```

The unrelated wildcard certificate `p.ssafy.io` also exists on the same EC2.
It is not used by the SSAfer NGINX config and must not be deleted unless ownership and usage are confirmed.

## Current Certificates

Checked with:

```bash
sudo certbot certificates
```

Relevant SSAfer certificate:

```text
Certificate Name: <LEGACY_DEPLOY_DOMAIN>
Identifiers: <LEGACY_DEPLOY_DOMAIN>
Certificate Path: /etc/letsencrypt/live/<LEGACY_DEPLOY_DOMAIN>/fullchain.pem
Private Key Path: /etc/letsencrypt/live/<LEGACY_DEPLOY_DOMAIN>/privkey.pem
```

Unrelated wildcard certificate:

```text
Certificate Name: p.ssafy.io
Identifiers: *.p.ssafy.io
```

## Renewal Configuration

Checked with:

```bash
sudo grep -n "authenticator\|webroot_path" /etc/letsencrypt/renewal/<LEGACY_DEPLOY_DOMAIN>.conf
```

Confirmed:

```text
authenticator = webroot
webroot_path = /var/www/certbot,
```

This means Certbot renews `<LEGACY_DEPLOY_DOMAIN>` through the NGINX-served ACME webroot instead of binding port 80 itself.

## ACME Webroot

NGINX must serve this path over HTTP:

```text
http://<LEGACY_DEPLOY_DOMAIN>/.well-known/acme-challenge/<token>
```

The NGINX config must keep the ACME location before the HTTP to HTTPS redirect:

```nginx
location /.well-known/acme-challenge/ {
    root /var/www/certbot;
}
```

The NGINX container must mount:

```yaml
- /etc/letsencrypt:/etc/letsencrypt:ro
- /var/www/certbot:/var/www/certbot:ro
```

## Dry Run

Use cert-name scoped dry-run for SSAfer validation:

```bash
sudo certbot renew --dry-run --cert-name <LEGACY_DEPLOY_DOMAIN>
```

This is the correct validation command while the unrelated `p.ssafy.io` wildcard certificate remains on the host.

Do not use the full command as the only pass/fail signal:

```bash
sudo certbot renew --dry-run
```

Reason:

```text
certbot renew --dry-run tries to renew every certificate on the host.
p.ssafy.io uses the manual plugin and can fail without manual auth hooks.
That failure is unrelated to the SSAfer service certificate.
```

## Deploy Hook

When Certbot renews the certificate, reload the NGINX container so it reads the renewed certificate files.

Recommended hook:

```bash
sudo mkdir -p /etc/letsencrypt/renewal-hooks/deploy
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-ssafer-nginx.sh >/dev/null <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
docker exec ssafer-nginx nginx -s reload
EOF
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-ssafer-nginx.sh
```

Validate after hook creation:

```bash
sudo certbot renew --dry-run --cert-name <LEGACY_DEPLOY_DOMAIN>
```

## Timer Check

Check the Certbot timer:

```bash
systemctl list-timers | grep -E 'certbot|snap.certbot'
systemctl status certbot.timer --no-pager
```

Depending on the Certbot installation method, the timer name can differ.

## Completion Criteria

- `<LEGACY_DEPLOY_DOMAIN>` renewal config uses `webroot`.
- ACME challenge path is served by the NGINX container.
- Scoped dry-run succeeds:
  ```bash
  sudo certbot renew --dry-run --cert-name <LEGACY_DEPLOY_DOMAIN>
  ```
- NGINX container reload hook is configured.
- `p.ssafy.io` wildcard certificate is not deleted until ownership is confirmed.

# Official Domain, HTTPS, and OAuth Alignment

## Goal

Use `https://ssafer.co.kr` as the official user-facing production domain.

The old SSAFY domain, `k14b105.p.ssafy.io`, remains as a redirect alias. It still needs its own valid certificate because HTTPS redirect can happen only after the TLS handshake succeeds.

## Problem

The service previously had split domain behavior:

- `k14b105.p.ssafy.io` had a Let's Encrypt certificate.
- `ssafer.co.kr` was connected through Gabia, but HTTPS and application settings were not fully aligned.
- Login/OAuth could work on one domain and fail on the other because frontend build env, OAuth redirect URI, CORS origin, and NGINX `server_name` were not using one canonical domain.

## Required Runtime Values

EC2 #1 prod `.env` should contain:

```env
APP_BASE_URL=https://ssafer.co.kr
VITE_API_BASE_URL=https://ssafer.co.kr/api/v1
VITE_GOOGLE_CLIENT_ID=REPLACE_WITH_GOOGLE_CLIENT_ID
VITE_GITHUB_CLIENT_ID=REPLACE_WITH_GITHUB_CLIENT_ID
N8N_EDITOR_BASE_URL=https://ssafer.co.kr/n8n/
```

`VITE_*` values are build-time values for the React/Vite app. Jenkins reads them from EC2 #1 prod `.env` and passes them to the NGINX image build.

## Certificate Prerequisite

Before deploying the NGINX image that uses `ssafer.co.kr`, issue a certificate on EC2 #1:

```bash
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d ssafer.co.kr
```

Expected paths:

```text
/etc/letsencrypt/live/ssafer.co.kr/fullchain.pem
/etc/letsencrypt/live/ssafer.co.kr/privkey.pem
```

Then verify renewal:

```bash
sudo certbot renew --dry-run --cert-name ssafer.co.kr
```

## NGINX Policy

- HTTP requests for `ssafer.co.kr` and `k14b105.p.ssafy.io` redirect directly to `https://ssafer.co.kr`.
- `https://ssafer.co.kr` serves the React app and proxies `/api/`, `/n8n/`, and `/jenkins/`.
- `https://k14b105.p.ssafy.io` keeps its own certificate and redirects to `https://ssafer.co.kr`.

Do not remove the `k14b105.p.ssafy.io` certificate block while the domain can still receive HTTPS traffic. Without that certificate, browsers cannot complete TLS and NGINX cannot return the redirect response.

## OAuth/CORS Checklist

Update provider and backend settings to match the official domain:

- Google OAuth authorized redirect URI
- GitHub OAuth callback URL
- Spring CORS allowed origins
- Any frontend callback route used by the OAuth flow

Validation targets:

```text
https://ssafer.co.kr
https://ssafer.co.kr/api/v1/...
https://ssafer.co.kr/n8n/
https://ssafer.co.kr/jenkins/
```

Browser console should not show CORS, mixed content, or OAuth redirect mismatch errors.

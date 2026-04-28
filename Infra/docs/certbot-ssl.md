# Certbot SSL Setup

`S14P31B105-156` 기준 Certbot SSL 인증서 발급 및 NGINX 연동 가이드입니다.

## 대상

- Server: EC2 #1
- Domain: `k14b105.p.ssafy.io`
- Certificate path: `/etc/letsencrypt/live/k14b105.p.ssafy.io/`
- ACME webroot: `/var/www/certbot`

## 방식 선택

Let's Encrypt HTTP-01 인증은 외부 CA가 아래 경로로 접속해 challenge 파일을 확인하는 방식입니다.

```text
http://k14b105.p.ssafy.io/.well-known/acme-challenge/<token>
```

따라서 80 포트가 외부에서 접근 가능해야 합니다.

| 방식 | 80 포트 사용자 | NGINX 필요 여부 | 적합한 상황 |
| --- | --- | --- | --- |
| `standalone` | Certbot | 필요 없음 | 초기 인증서 발급 |
| `webroot` | NGINX | 필요함 | 운영 중 인증서 갱신 |

현재 프로젝트에서는 초기 발급은 `standalone`, 운영 갱신은 `webroot` 방식을 권장합니다.

## 사전 확인

도메인이 EC2 #1 public IP를 바라보는지 확인합니다.

```bash
curl ifconfig.me
nslookup k14b105.p.ssafy.io
```

UFW와 AWS Security Group에서 80, 443 포트가 열려 있어야 합니다.

```bash
sudo ufw status numbered
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

80 포트 사용 여부를 확인합니다.

```bash
sudo ss -ltnp | grep ':80'
```

출력이 없다면 80 포트가 비어 있으므로 `standalone` 방식으로 초기 발급을 진행할 수 있습니다.

## 초기 인증서 발급

NGINX가 아직 떠 있지 않은 초기 상태에서는 Certbot이 80 포트에 임시 웹서버를 띄우는 `standalone` 방식으로 인증서를 발급합니다.

```bash
sudo certbot certonly --standalone \
  -d k14b105.p.ssafy.io
```

발급 결과를 확인합니다.

```bash
sudo ls -al /etc/letsencrypt/live/k14b105.p.ssafy.io/
```

아래 파일들이 존재해야 합니다.

- `fullchain.pem`
- `privkey.pem`
- `cert.pem`
- `chain.pem`

## NGINX 연동

인증서 발급 후 NGINX 컨테이너가 인증서와 ACME webroot를 읽을 수 있도록 volume을 연결합니다.

```yaml
- /etc/letsencrypt:/etc/letsencrypt:ro
- /var/www/certbot:/var/www/certbot:ro
```

HTTP 80 서버에서는 ACME challenge 경로가 HTTPS redirect보다 먼저 처리되어야 합니다.

```nginx
location /.well-known/acme-challenge/ {
    root /var/www/certbot;
}
```

이 예외가 없으면 webroot 갱신 시 challenge 요청이 redirect되어 실패할 수 있습니다.

## NGINX 기동 후 검증

Jenkins pipeline 또는 수동 deploy로 NGINX 컨테이너를 기동한 뒤 HTTPS를 확인합니다.

```bash
curl -I https://k14b105.p.ssafy.io
curl -I http://k14b105.p.ssafy.io
```

확인 기준:

- HTTPS 요청의 TLS handshake가 성공해야 합니다.
- HTTP 요청은 HTTPS로 redirect되어야 합니다.

## 운영 갱신 확인

NGINX가 80 포트에서 ACME challenge 경로를 제공하는 상태가 되면 dry-run으로 자동 갱신을 검증합니다.

```bash
sudo certbot renew --dry-run
```

실패하면 아래 항목을 확인합니다.

- DNS가 EC2 #1 public IP를 바라보는지
- UFW와 AWS Security Group에서 80/tcp가 열려 있는지
- NGINX가 80 포트에서 실행 중인지
- `/var/www/certbot` volume mount가 맞는지
- `/.well-known/acme-challenge/` location이 redirect보다 먼저 처리되는지

## Troubleshooting

webroot 발급 중 아래 오류가 발생할 수 있습니다.

```text
Detail: Fetching http://k14b105.p.ssafy.io/.well-known/acme-challenge/...: Connection refused
```

이 경우 DNS는 EC2까지 도달했지만, 해당 IP의 80 포트에서 요청을 받을 프로세스가 없거나 방화벽 또는 Security Group에서 차단된 상태입니다.

초기 발급이라면 `standalone` 방식으로 인증서를 먼저 발급하고, 운영 갱신 단계에서 NGINX `webroot` 구성을 검증합니다.

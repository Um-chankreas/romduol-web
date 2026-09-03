# Nginx deployment — web.romduolscholars.com

The frontend is a Vue SPA built with `createWebHistory`, so the web server must
return `index.html` for any unknown path. Without this, opening
`https://web.romduolscholars.com/privacy-policy` directly (which is what Apple's
reviewers do) returns 404.

## Build

```bash
npm run build      # outputs to dist/
```

Copy `dist/` to the server, e.g. `/var/www/romduol-web`.

## Server block

```nginx
server {
    listen 443 ssl http2;
    server_name web.romduolscholars.com;

    ssl_certificate     /etc/letsencrypt/live/web.romduolscholars.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/web.romduolscholars.com/privkey.pem;

    root /var/www/romduol-web;
    index index.html;

    # Hashed assets — cache hard
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback: every unknown path serves index.html so client-side
    # routes like /privacy-policy work on direct load / refresh.
    location / {
        try_files $uri $uri/ /index.html;
    }
}

server {
    listen 80;
    server_name web.romduolscholars.com;
    return 301 https://$host$request_uri;
}
```

Reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Verify (must return 200 + HTML, not 404)

```bash
curl -I https://web.romduolscholars.com/privacy-policy
```

## App Store / Play Store URL

```
https://web.romduolscholars.com/privacy-policy
```

Paste this into:
- App Store Connect → App Privacy → Privacy Policy URL
- Google Play Console → App content → Privacy policy

# PrintGoo ERP - Hikvision ISUP 5.0 Gateway Microservice

Bu mikroxizmat Hikvision Face ID terminallarining bulutli **ISUP 5.0 (EHome)** protokoli ulanishlarini qabul qilish va boshqarish uchun yaratilgan.

## Arxitektura
```
[Face ID Device (NAT orqasida)]
        |
        | ISUP 5.0 TCP (Port 7660 / 7661)
        v
[isup-gateway (Docker Konteyner)]
        |
        | HTTP Webhook (Port 7662 -> ERP Webhook)
        v
[PrintGoo ERP (Next.js 16 Backend)]
```

## Portlar
- **7660 (TCP)**: Hikvision ISUP CMS porti (Qurilmani ro'yxatdan o'tkazish va Heartbeat).
- **7661 (TCP)**: Hikvision ISUP Alarm porti (Davomat va yuz skan hodisalari).
- **7662 (HTTP)**: ERP uchun ichki boshqaruv REST API (Eshik ochish, xodim yuklash, test qilish).

## Ishga tushirish (Docker)

```bash
cd services/isup-gateway
docker compose up -d --build
```

Loglarni ko'rish:
```bash
docker logs -f printgoo-isup-gateway
```

## Muhit O'zgaruvchilari (Environment Variables)
- `ISUP_CMS_PORT`: Sukut bo'yicha `7660`
- `ISUP_ALARM_PORT`: Sukut bo'yicha `7661`
- `HTTP_PORT`: Sukut bo'yicha `7662`
- `ERP_WEBHOOK_URL`: Next.js ERP ning davomat hodisasi qabul qiluvchi manzili (masalan `http://host.docker.internal:3000/api/v1/hr/attendance/hikvision-event` yoki `http://erp-app:3000/...`)
- `GATEWAY_SECRET`: Begona so'rovlardan himoyalovchi maxfiy kalit (`printgoo_isup_secret_2026`)
- `COMPANY_CODE`: Standart `PRINTGOO`

## Ichki REST API (Port 7662)
- `GET /health` — Xizmat holati va onlayn qurilmalar soni
- `GET /devices` — Barcha ulangan terminallar ro'yxati
- `GET /devices/{deviceId}` — Tanlangan terminalning ulanish holati
- `POST /devices/{deviceId}/open-door` — Turniket relayini ochish
- `POST /devices/{deviceId}/sync-user` — Xodim ma'lumotlari va suratini terminalga uzatish
- `DELETE /devices/{deviceId}/user/{badgeNumber}` — Xodim ruxsatini o'chirish
- `POST /simulator/event` — Haqiqiy apparatsiz test o'tkazish uchun yuz skan hodisasini generatsiya qilish

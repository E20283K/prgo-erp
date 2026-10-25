# ─── Stage 1: Build ─────────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Download dependencies
COPY go.mod ./
# If go.sum exists, copy it
# COPY go.sum ./

# Copy source code
COPY . .

# Compile binary statically (Zero CGO, pure Go)
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o isup-gateway .

# ─── Stage 2: Final Minimal Image ─────────────────────────────────────────────
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata
ENV TZ=Asia/Tashkent

WORKDIR /app

COPY --from=builder /app/isup-gateway /app/isup-gateway

# Hikvision ISUP 5.0 CMS, Alarm, and Internal REST API ports
EXPOSE 7660 7661 7662

ENTRYPOINT ["/app/isup-gateway"]

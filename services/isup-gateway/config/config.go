package config

import (
	"os"
	"strconv"
)

type Config struct {
	CMSPort        int
	AlarmPort      int
	HTTPPort       int
	ERPWebhookURL  string
	GatewaySecret  string
	CompanyCode    string
	HeartbeatCheck int // seconds before marking device stale
}

func LoadConfig() *Config {
	return &Config{
		CMSPort:        getEnvAsInt("ISUP_CMS_PORT", 7660),
		AlarmPort:      getEnvAsInt("ISUP_ALARM_PORT", 7661),
		HTTPPort:       getEnvAsInt("HTTP_PORT", 7662),
		ERPWebhookURL:  getEnv("ERP_WEBHOOK_URL", "http://host.docker.internal:3000/api/v1/hr/attendance/hikvision-event"),
		GatewaySecret:  getEnv("GATEWAY_SECRET", "printgoo_isup_secret_2026"),
		CompanyCode:    getEnv("COMPANY_CODE", "PRINTGOO"),
		HeartbeatCheck: getEnvAsInt("HEARTBEAT_TIMEOUT_SEC", 60),
	}
}

func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return defaultVal
}

func getEnvAsInt(key string, defaultVal int) int {
	valStr := getEnv(key, "")
	if val, err := strconv.Atoi(valStr); err == nil {
		return val
	}
	return defaultVal
}

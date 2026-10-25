package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/printgoo/isup-gateway/api"
	"github.com/printgoo/isup-gateway/config"
	"github.com/printgoo/isup-gateway/isup"
)

func main() {
	log.Println("======================================================")
	log.Println(" PrintGoo ERP - Hikvision ISUP 5.0 Gateway Microservice")
	log.Println("======================================================")

	cfg := config.LoadConfig()
	log.Printf("[CONFIG] CMS Port: %d, Alarm Port: %d, HTTP Port: %d", cfg.CMSPort, cfg.AlarmPort, cfg.HTTPPort)
	log.Printf("[CONFIG] ERP Webhook: %s", cfg.ERPWebhookURL)

	sm := isup.NewSessionManager()
	sm.StartJanitor(cfg.HeartbeatCheck)

	server := isup.NewServer(cfg, sm)

	// 1. Start ISUP CMS TCP Server (7660)
	if err := server.StartCMSListener(); err != nil {
		log.Fatalf("[FATAL] CMS server ishga tushmadi: %v", err)
	}

	// 2. Start ISUP Alarm TCP Server (7661)
	if err := server.StartAlarmListener(); err != nil {
		log.Fatalf("[FATAL] Alarm server ishga tushmadi: %v", err)
	}

	// 3. Start Internal REST API Server (7662)
	router := api.NewRouter(cfg, sm, server)
	mux := http.NewServeMux()
	router.RegisterRoutes(mux)

	httpServer := &http.Server{
		Addr:         fmt.Sprintf("0.0.0.0:%d", cfg.HTTPPort),
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("[HTTP API] Boshqaruv REST API ishga tushdi: http://0.0.0.0:%d", cfg.HTTPPort)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[FATAL] HTTP server xatoligi: %v", err)
		}
	}()

	// 4. Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[SHUTDOWN] Gateway to'xtatilmoqda...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("[SHUTDOWN] HTTP serverni to'xtatishda xatolik: %v", err)
	}

	// Close all device sockets
	for _, s := range sm.GetAll() {
		s.Close()
	}

	log.Println("[SHUTDOWN] ISUP Gateway xizmati toza to'xtatildi.")
}

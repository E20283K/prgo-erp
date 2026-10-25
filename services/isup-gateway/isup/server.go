package isup

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/printgoo/isup-gateway/config"
)

type Server struct {
	cfg        *config.Config
	sm         *SessionManager
	httpClient *http.Client
}

func NewServer(cfg *config.Config, sm *SessionManager) *Server {
	return &Server{
		cfg: cfg,
		sm:  sm,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// StartCMSListener starts the ISUP 5.0 CMS registration and heartbeat TCP listener (7660)
func (s *Server) StartCMSListener() error {
	addr := fmt.Sprintf("0.0.0.0:%d", s.cfg.CMSPort)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("CMS portini ochib bo'lmadi (%s): %w", addr, err)
	}

	log.Printf("[ISUP CMS] TCP server ishga tushdi: %s (Ro'yxatdan o'tish va Heartbeat)", addr)

	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				log.Printf("[ISUP CMS] Ulanishni qabul qilishda xatolik: %v", err)
				continue
			}

			go s.handleCMSConnection(conn)
		}
	}()

	return nil
}

// StartAlarmListener starts the ISUP 5.0 Alarm/Event TCP listener (7661)
func (s *Server) StartAlarmListener() error {
	addr := fmt.Sprintf("0.0.0.0:%d", s.cfg.AlarmPort)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("Alarm portini ochib bo'lmadi (%s): %w", addr, err)
	}

	log.Printf("[ISUP ALARM] TCP server ishga tushdi: %s (Hodisalar qabul qiluvchi)", addr)

	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				log.Printf("[ISUP ALARM] Ulanishni qabul qilishda xatolik: %v", err)
				continue
			}

			go s.handleAlarmConnection(conn)
		}
	}()

	return nil
}

func (s *Server) handleCMSConnection(conn net.Conn) {
	remoteAddr := conn.RemoteAddr().String()
	log.Printf("[ISUP CMS] Yangi ulanish: %s", remoteAddr)

	buf := make([]byte, 4096)
	var currentDeviceID string

	defer func() {
		if currentDeviceID != "" {
			log.Printf("[ISUP CMS] Qurilma uzildi: %s (%s)", currentDeviceID, remoteAddr)
			s.sm.Deregister(currentDeviceID)
		} else {
			_ = conn.Close()
		}
	}()

	for {
		_ = conn.SetReadDeadline(time.Now().Add(90 * time.Second))
		n, err := conn.Read(buf)
		if err != nil {
			if err != io.EOF {
				log.Printf("[ISUP CMS] O'qishda xatolik (%s): %v", remoteAddr, err)
			}
			return
		}

		payload := buf[:n]
		text := string(payload)

		// 1. Check for ISUP Registration
		if strings.Contains(text, "REGISTER") || strings.Contains(text, "deviceID") || strings.Contains(text, "devId") {
			deviceID := extractDeviceID(text)
			if deviceID == "" {
				deviceID = fmt.Sprintf("DEV-%s", strings.ReplaceAll(remoteAddr, ":", "-"))
			}

			currentDeviceID = deviceID
			session := s.sm.Register(deviceID, "", remoteAddr, conn)
			log.Printf("[ISUP CMS] Qurilma muvaffaqiyatli ro'yxatdan o'tdi: ID=%s, Addr=%s", deviceID, remoteAddr)

			// Send ISUP Registration ACK
			ack := []byte(fmt.Sprintf("ISUP/5.0 200 OK\r\nDevice-ID: %s\r\nSession-ID: %d\r\n\r\n", deviceID, time.Now().Unix()))
			_ = session.SendRaw(ack)
			continue
		}

		// 2. Check for Heartbeat (Keep-alive)
		if strings.Contains(text, "HEARTBEAT") || strings.Contains(text, "keepalive") || strings.Contains(text, "ping") {
			if currentDeviceID != "" {
				s.sm.UpdateHeartbeat(currentDeviceID)
				// Send Heartbeat ACK
				pong := []byte("ISUP/5.0 200 OK\r\nType: PONG\r\n\r\n")
				_, _ = conn.Write(pong)
			}
			continue
		}

		// If payload contains alarm event embedded in CMS stream
		if strings.Contains(text, "AccessControllerEvent") || strings.Contains(text, "employeeNo") {
			event, err := ParseISUPEvent(payload, currentDeviceID)
			if err == nil && event.EmployeeNo != "" {
				go s.ForwardEventToERP(event)
			}
		}
	}
}

func (s *Server) handleAlarmConnection(conn net.Conn) {
	remoteAddr := conn.RemoteAddr().String()
	log.Printf("[ISUP ALARM] Yangi alarm ulanishi: %s", remoteAddr)
	defer conn.Close()

	buf := make([]byte, 8192)
	for {
		_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		n, err := conn.Read(buf)
		if err != nil {
			return
		}

		payload := buf[:n]
		event, err := ParseISUPEvent(payload, "")
		if err == nil && event.EmployeeNo != "" {
			log.Printf("[ISUP ALARM] Davomat hodisasi keldi: Badge=%s, Dev=%s, Time=%s",
				event.EmployeeNo, event.DeviceID, event.DateTime.Format("15:04:05"))

			// Forward to ERP
			go s.ForwardEventToERP(event)

			// Send ACK to device
			ack := []byte("ISUP/5.0 200 OK\r\nAlarm-Ack: true\r\n\r\n")
			_, _ = conn.Write(ack)
		}
	}
}

// ForwardEventToERP forwards parsed biometric event to Next.js ERP API
func (s *Server) ForwardEventToERP(event *RawAlarmEvent) {
	bodyData := map[string]interface{}{
		"AccessControllerEvent": map[string]interface{}{
			"employeeNoString": event.EmployeeNo,
			"dateTime":         event.DateTime.Format(time.RFC3339),
			"deviceName":       event.DeviceID,
			"doorNo":           event.DoorNo,
			"verifyMode":       event.VerifyMode,
		},
		"ipAddress": event.DeviceID,
		"dateTime":  event.DateTime.Format(time.RFC3339),
		"badgeNumber": event.EmployeeNo,
		"source":    "isup-gateway",
	}

	jsonBytes, err := json.Marshal(bodyData)
	if err != nil {
		log.Printf("[ISUP -> ERP] JSON xatolik: %v", err)
		return
	}

	url := fmt.Sprintf("%s?company=%s", s.cfg.ERPWebhookURL, s.cfg.CompanyCode)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		log.Printf("[ISUP -> ERP] So'rov yaratishda xatolik: %v", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-gateway-secret", s.cfg.GatewaySecret)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Printf("[ISUP -> ERP] Webhookga ulanib bo'lmadi (%s): %v", url, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		log.Printf("[ISUP -> ERP] Muvaffaqiyatli yetkazildi (HTTP %d)", resp.StatusCode)
	} else {
		resBody, _ := io.ReadAll(resp.Body)
		log.Printf("[ISUP -> ERP] ERP xatolik qaytardi (HTTP %d): %s", resp.StatusCode, string(resBody))
	}
}

func extractDeviceID(text string) string {
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "deviceID:") || strings.HasPrefix(line, "Device-ID:") {
			parts := strings.Split(line, ":")
			if len(parts) >= 2 {
				return strings.TrimSpace(parts[1])
			}
		}
	}
	return ""
}

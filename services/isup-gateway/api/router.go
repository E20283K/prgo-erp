package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/printgoo/isup-gateway/config"
	"github.com/printgoo/isup-gateway/isup"
)

type Router struct {
	cfg        *config.Config
	sm         *isup.SessionManager
	isupServer *isup.Server
}

func NewRouter(cfg *config.Config, sm *isup.SessionManager, isupServer *isup.Server) *Router {
	return &Router{
		cfg:        cfg,
		sm:         sm,
		isupServer: isupServer,
	}
}

func (r *Router) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/health", r.handleHealth)
	mux.HandleFunc("/devices", r.handleDevices)
	mux.HandleFunc("/devices/", r.handleDeviceActions)
	mux.HandleFunc("/simulator/event", r.handleSimulatorEvent)
}

func (r *Router) handleHealth(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	sessions := r.sm.GetAll()
	onlineCount := 0
	for _, s := range sessions {
		if s.Status == "online" {
			onlineCount++
		}
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"status":        "ok",
		"service":       "isup-gateway",
		"onlineDevices": onlineCount,
		"totalSessions": len(sessions),
		"timestamp":     time.Now().Format(time.RFC3339),
	})
}

func (r *Router) handleDevices(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	sessions := r.sm.GetAll()
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"devices": sessions,
	})
}

func (r *Router) handleDeviceActions(w http.ResponseWriter, req *http.Request) {
	// Path pattern: /devices/{id}/action
	path := strings.TrimPrefix(req.URL.Path, "/devices/")
	parts := strings.Split(path, "/")
	if len(parts) == 0 || parts[0] == "" {
		http.Error(w, "Device ID required", http.StatusBadRequest)
		return
	}

	deviceID := parts[0]
	session, exists := r.sm.Get(deviceID)

	// GET /devices/{id}
	if len(parts) == 1 && req.Method == http.MethodGet {
		if !exists || session.Status != "online" {
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"success": false,
				"status":  "offline",
				"message": fmt.Sprintf("Qurilma (%s) ISUP serverga ulanmagan (Offline)", deviceID),
			})
			return
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success":       true,
			"status":        "online",
			"remoteAddr":    session.RemoteAddr,
			"lastHeartbeat": session.LastHeartbeat.Format(time.RFC3339),
			"connectedAt":   session.ConnectedAt.Format(time.RFC3339),
		})
		return
	}

	if len(parts) < 2 {
		http.Error(w, "Invalid action", http.StatusBadRequest)
		return
	}

	action := parts[1]

	// Check if device is online before sending commands
	if !exists || session.Status != "online" {
		respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
			"success": false,
			"message": fmt.Sprintf("Qurilma (%s) oflayn holatda, buyruq uzatib bo'lmadi", deviceID),
		})
		return
	}

	switch action {
	case "open-door":
		// POST /devices/{id}/open-door
		if req.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		cmd := []byte("COMMAND: OPEN_DOOR\r\nDoor-No: 1\r\nTimeout: 3\r\n\r\n")
		err := session.SendRaw(cmd)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
				"success": false,
				"message": fmt.Sprintf("Eshikni ochish buyrug'i uzatilmadi: %v", err),
			})
			return
		}

		log.Printf("[ISUP API] Turniket ochildi: Dev=%s", deviceID)
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"message": "Turniket ochish buyrug'i ISUP kanali orqali yetkazildi",
		})

	case "sync-user":
		// POST /devices/{id}/sync-user
		if req.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var userReq isup.UserSyncRequest
		if err := json.NewDecoder(req.Body).Decode(&userReq); err != nil {
			http.Error(w, "Yaroqsiz JSON payload", http.StatusBadRequest)
			return
		}

		if userReq.BadgeNumber == "" || userReq.FullName == "" {
			http.Error(w, "badgeNumber va fullName majburiy", http.StatusBadRequest)
			return
		}

		// Pack ISUP command
		payload, _ := json.Marshal(userReq)
		cmd := []byte(fmt.Sprintf("COMMAND: SYNC_USER\r\nContent-Length: %d\r\n\r\n%s", len(payload), string(payload)))
		err := session.SendRaw(cmd)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
				"success": false,
				"message": fmt.Sprintf("Foydalanuvchini yuklash buyrug'i uzatilmadi: %v", err),
			})
			return
		}

		log.Printf("[ISUP API] Xodim terminalga yuklandi: Dev=%s, Badge=%s, Name=%s",
			deviceID, userReq.BadgeNumber, userReq.FullName)

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"message": fmt.Sprintf("%s (%s) ma'lumotlari ISUP orqali terminalga yuklandi", userReq.FullName, userReq.BadgeNumber),
		})

	case "user":
		// DELETE /devices/{id}/user/{badgeNumber}
		if req.Method != http.MethodDelete {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if len(parts) < 3 || parts[2] == "" {
			http.Error(w, "Badge number required", http.StatusBadRequest)
			return
		}

		badgeNumber := parts[2]
		cmd := []byte(fmt.Sprintf("COMMAND: DELETE_USER\r\nBadge-Number: %s\r\n\r\n", badgeNumber))
		err := session.SendRaw(cmd)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
				"success": false,
				"message": fmt.Sprintf("Foydalanuvchini o'chirish buyrug'i uzatilmadi: %v", err),
			})
			return
		}

		log.Printf("[ISUP API] Xodim ruxsati o'chirildi: Dev=%s, Badge=%s", deviceID, badgeNumber)
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"message": fmt.Sprintf("%s raqamli xodim ruxsati ISUP orqali o'chirildi", badgeNumber),
		})

	default:
		http.Error(w, "Noma'lum harakat", http.StatusNotFound)
	}
}

// POST /simulator/event triggers a simulated face scan event for testing without real hardware
func (r *Router) handleSimulatorEvent(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var simReq struct {
		DeviceID   string `json:"deviceId"`
		EmployeeNo string `json:"employeeNo"`
		VerifyMode string `json:"verifyMode"`
	}

	if err := json.NewDecoder(req.Body).Decode(&simReq); err != nil {
		http.Error(w, "Yaroqsiz JSON", http.StatusBadRequest)
		return
	}

	if simReq.EmployeeNo == "" {
		http.Error(w, "employeeNo majburiy", http.StatusBadRequest)
		return
	}

	if simReq.DeviceID == "" {
		simReq.DeviceID = "SIM-FACEID-01"
	}

	event := &isup.RawAlarmEvent{
		DeviceID:   simReq.DeviceID,
		EmployeeNo: simReq.EmployeeNo,
		DateTime:   time.Now(),
		VerifyMode: simReq.VerifyMode,
		DoorNo:     1,
	}

	// Forward simulated event to ERP via Webhook
	go r.isupServer.ForwardEventToERP(event)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Simulyator hodisasi ERP ga yuborildi: Badge=%s, Dev=%s", simReq.EmployeeNo, simReq.DeviceID),
		"event":   event,
	})
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

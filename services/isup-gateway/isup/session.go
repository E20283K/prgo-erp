package isup

import (
	"fmt"
	"net"
	"sync"
	"time"
)

type DeviceSession struct {
	DeviceID      string    `json:"deviceId"`
	DeviceKey     string    `json:"-"`
	RemoteAddr    string    `json:"remoteAddr"`
	ConnectedAt   time.Time `json:"connectedAt"`
	LastHeartbeat time.Time `json:"lastHeartbeat"`
	Status        string    `json:"status"` // "online" | "stale" | "offline"
	Firmware      string    `json:"firmware,omitempty"`

	conn net.Conn
	mu   sync.Mutex
}

func (s *DeviceSession) SendRaw(data []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.conn == nil {
		return fmt.Errorf("qurilma (%s) bilan aloqa o'rnatilmagan", s.DeviceID)
	}

	_ = s.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	_, err := s.conn.Write(data)
	return err
}

func (s *DeviceSession) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.conn != nil {
		_ = s.conn.Close()
		s.conn = nil
	}
	s.Status = "offline"
}

type SessionManager struct {
	sessions map[string]*DeviceSession
	mu       sync.RWMutex
}

func NewSessionManager() *SessionManager {
	return &SessionManager{
		sessions: make(map[string]*DeviceSession),
	}
}

func (sm *SessionManager) Register(deviceID, deviceKey, remoteAddr string, conn net.Conn) *DeviceSession {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	// If old session exists, close it
	if old, exists := sm.sessions[deviceID]; exists {
		old.Close()
	}

	now := time.Now()
	session := &DeviceSession{
		DeviceID:      deviceID,
		DeviceKey:     deviceKey,
		RemoteAddr:    remoteAddr,
		ConnectedAt:   now,
		LastHeartbeat: now,
		Status:        "online",
		conn:          conn,
	}

	sm.sessions[deviceID] = session
	return session
}

func (sm *SessionManager) UpdateHeartbeat(deviceID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if s, exists := sm.sessions[deviceID]; exists {
		s.LastHeartbeat = time.Now()
		s.Status = "online"
	}
}

func (sm *SessionManager) Get(deviceID string) (*DeviceSession, bool) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	s, exists := sm.sessions[deviceID]
	return s, exists
}

func (sm *SessionManager) GetAll() []*DeviceSession {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	result := make([]*DeviceSession, 0, len(sm.sessions))
	for _, s := range sm.sessions {
		result = append(result, s)
	}
	return result
}

func (sm *SessionManager) Deregister(deviceID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if s, exists := sm.sessions[deviceID]; exists {
		s.Close()
		delete(sm.sessions, deviceID)
	}
}

func (sm *SessionManager) StartJanitor(timeoutSec int) {
	ticker := time.NewTicker(30 * time.Second)
	go func() {
		for range ticker.C {
			sm.mu.Lock()
			threshold := time.Now().Add(-time.Duration(timeoutSec) * time.Second)
			for id, s := range sm.sessions {
				if s.LastHeartbeat.Before(threshold) {
					s.Status = "offline"
					s.Close()
					delete(sm.sessions, id)
				}
			}
			sm.mu.Unlock()
		}
	}()
}

package simulator

import (
	"fmt"
	"log"
	"net"
	"time"
)

type DeviceSimulator struct {
	DeviceID   string
	ServerHost string
	CMSPort    int
	AlarmPort  int
	stopChan   chan struct{}
}

func NewDeviceSimulator(deviceID, serverHost string, cmsPort, alarmPort int) *DeviceSimulator {
	return &DeviceSimulator{
		DeviceID:   deviceID,
		ServerHost: serverHost,
		CMSPort:    cmsPort,
		AlarmPort:  alarmPort,
		stopChan:   make(chan struct{}),
	}
}

// Start connects to the ISUP CMS port, registers, and starts sending periodic heartbeats
func (s *DeviceSimulator) Start() error {
	addr := fmt.Sprintf("%s:%d", s.ServerHost, s.CMSPort)
	conn, err := net.Dial("tcp", addr)
	if err != nil {
		return fmt.Errorf("simulyator ISUP serverga ulanolmadi (%s): %w", addr, err)
	}

	log.Printf("[SIMULATOR] Face ID Simulyatori ulandi: %s -> %s", s.DeviceID, addr)

	// 1. Send ISUP Registration packet
	regPacket := fmt.Sprintf("ISUP/5.0 REGISTER\r\nDevice-ID: %s\r\nFirmware: V1.5.0_build260101\r\n\r\n", s.DeviceID)
	if _, err := conn.Write([]byte(regPacket)); err != nil {
		conn.Close()
		return fmt.Errorf("ro'yxatdan o'tish paketi yuborilmadi: %w", err)
	}

	// 2. Start heartbeat loop
	go func() {
		ticker := time.NewTicker(20 * time.Second)
		defer ticker.Stop()
		defer conn.Close()

		for {
			select {
			case <-s.stopChan:
				log.Printf("[SIMULATOR] Simulyator to'xtatildi: %s", s.DeviceID)
				return
			case <-ticker.C:
				ping := fmt.Sprintf("ISUP/5.0 HEARTBEAT\r\nDevice-ID: %s\r\nTime: %d\r\n\r\n", s.DeviceID, time.Now().Unix())
				if _, err := conn.Write([]byte(ping)); err != nil {
					log.Printf("[SIMULATOR] Heartbeat yuborishda xatolik: %v", err)
					return
				}
			}
		}
	}()

	return nil
}

// Stop stops the simulator
func (s *DeviceSimulator) Stop() {
	close(s.stopChan)
}

// SendScanEvent sends a simulated face scan event to the Alarm port
func (s *DeviceSimulator) SendScanEvent(badgeNumber string) error {
	addr := fmt.Sprintf("%s:%d", s.ServerHost, s.AlarmPort)
	conn, err := net.Dial("tcp", addr)
	if err != nil {
		return fmt.Errorf("alarm portiga ulanib bo'lmadi: %w", err)
	}
	defer conn.Close()

	payload := fmt.Sprintf(`{
		"AccessControllerEvent": {
			"employeeNoString": "%s",
			"dateTime": "%s",
			"deviceName": "%s",
			"doorNo": 1,
			"currentVerifyMode": "face"
		}
	}`, badgeNumber, time.Now().Format(time.RFC3339), s.DeviceID)

	_, err = conn.Write([]byte(payload))
	return err
}

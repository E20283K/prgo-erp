package isup

import (
	"encoding/json"
	"strings"
	"time"
)

// Hikvision ISUP 5.0 (EHome) Packet types
const (
	MsgTypeRegister  = "REGISTER"
	MsgTypeHeartbeat = "HEARTBEAT"
	MsgTypeAlarm     = "ALARM"
	MsgTypeCommand   = "COMMAND"
	MsgTypeAck       = "ACK"
)

// RawAlarmEvent represents a parsed biometric event from a terminal
type RawAlarmEvent struct {
	DeviceID      string    `json:"deviceId"`
	DeviceName    string    `json:"deviceName,omitempty"`
	EmployeeNo    string    `json:"employeeNo"`
	DateTime      time.Time `json:"dateTime"`
	Direction     string    `json:"direction,omitempty"` // "in", "out", or ""
	DoorNo        int       `json:"doorNo,omitempty"`
	VerifyMode    string    `json:"verifyMode,omitempty"` // face, card, fingerprint
	SerialNo      int64     `json:"serialNo,omitempty"`
}

// UserSyncRequest represents user data to push to terminal
type UserSyncRequest struct {
	BadgeNumber string `json:"badgeNumber"`
	FullName    string `json:"fullName"`
	ValidUntil  string `json:"validUntil,omitempty"`
	AvatarBase64 string `json:"avatarBase64,omitempty"` // 3x4 photo for face record
}

// ParseISUPEvent attempts to parse XML or JSON formatted event payloads from Hikvision terminals
func ParseISUPEvent(payload []byte, defaultDeviceID string) (*RawAlarmEvent, error) {
	text := string(payload)

	// Clean any null bytes or binary padding
	text = strings.Trim(text, "\x00\r\n ")

	event := &RawAlarmEvent{
		DeviceID: defaultDeviceID,
		DateTime: time.Now(),
	}

	// 1. Try parsing JSON format
	if strings.Contains(text, "{") && strings.Contains(text, "}") {
		var rawMap map[string]interface{}
		if err := json.Unmarshal([]byte(text), &rawMap); err == nil {
			// Extract nested AccessControllerEvent
			var acMap map[string]interface{}
			if val, ok := rawMap["AccessControllerEvent"].(map[string]interface{}); ok {
				acMap = val
			} else {
				acMap = rawMap
			}

			// Extract badge number
			if emp, ok := acMap["employeeNoString"].(string); ok && emp != "" {
				event.EmployeeNo = emp
			} else if emp, ok := acMap["employeeNo"].(string); ok && emp != "" {
				event.EmployeeNo = emp
			} else if card, ok := acMap["cardNo"].(string); ok && card != "" {
				event.EmployeeNo = card
			}

			// Extract device ID if present
			if dev, ok := acMap["deviceID"].(string); ok && dev != "" {
				event.DeviceID = dev
			}

			// Extract timestamp
			if dtStr, ok := acMap["dateTime"].(string); ok && dtStr != "" {
				if parsed, err := time.Parse(time.RFC3339, dtStr); err == nil {
					event.DateTime = parsed
				} else if parsed, err := time.Parse("2006-01-02T15:04:05", dtStr); err == nil {
					event.DateTime = parsed
				}
			}

			return event, nil
		}
	}

	// 2. Try simple XML/text extraction if device sends XML-based ISUP alarm
	if strings.Contains(text, "employeeNoString") || strings.Contains(text, "employeeNo") {
		event.EmployeeNo = extractTagValue(text, "employeeNoString")
		if event.EmployeeNo == "" {
			event.EmployeeNo = extractTagValue(text, "employeeNo")
		}

		dtStr := extractTagValue(text, "dateTime")
		if dtStr != "" {
			if parsed, err := time.Parse(time.RFC3339, dtStr); err == nil {
				event.DateTime = parsed
			} else if parsed, err := time.Parse("2006-01-02T15:04:05", dtStr); err == nil {
				event.DateTime = parsed
			}
		}

		devID := extractTagValue(text, "deviceID")
		if devID != "" {
			event.DeviceID = devID
		}

		return event, nil
	}

	return event, nil
}

func extractTagValue(xml, tag string) string {
	openTag := "<" + tag + ">"
	closeTag := "</" + tag + ">"
	start := strings.Index(xml, openTag)
	if start == -1 {
		return ""
	}
	start += len(openTag)
	end := strings.Index(xml[start:], closeTag)
	if end == -1 {
		return ""
	}
	return xml[start : start+end]
}

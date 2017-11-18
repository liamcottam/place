package websocket

import (
	"encoding/json"
	"log"
)

// ChatObject is how messages are constructed
type ChatObject struct {
	ID      string `json:"id,omitempty"`
	Message string `json:"message"`
}

func ParseChatMessage(c *Client, props []json.RawMessage) {
	var message string
	err := json.Unmarshal(props[1], &message)
	if err != nil {
		log.Printf("error: %v", err)
		return
	}
	chatObj := ChatObject{
		ID:      c.ID,
		Message: message,
	}
	mixed := []interface{}{"chat", chatObj}
	log.Println(chatObj.Message)
	bytes, _ := json.Marshal(mixed)
	c.hub.broadcast <- bytes
}

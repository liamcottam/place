package websocket

import (
	"encoding/json"
	"log"
)

// ChatObject is how messages are constructed
type AuthRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func ProcessAuthRequest(c *Client, props []json.RawMessage) {
	data := AuthRequest{}
	err := json.Unmarshal(props[1], &data)
	if err != nil {
		log.Printf("error: %v", err)
		return
	}

	// TODO: Sanitize input?
	user, err := c.Service.UserService.Login(data.Username, data.Password)
	if err != nil {
		log.Printf("auth error: %v\n", err)
		return
	}
	log.Printf("User: %s\n", user.Username)
	

	/* chatObj.ID = c.ID
	mixed := []interface{}{"chat", chatObj}
	log.Println(chatObj.Message)
	bytes, _ := json.Marshal(mixed)
	c.hub.broadcast <- bytes */
}

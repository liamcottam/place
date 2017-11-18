package websocket

import (
	"log"
	"math/rand"
	"net/http"
	"place/server/database"
)

var (
	letters = []rune("abcdefghijklmnopqrstuvwxyz1234567890")
)

// RandStringBytes - Generates a random string with n length
func RandString(n int) string {
	b := make([]rune, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

type Service struct {
	UserService  *database.UserService
	ImageService *database.ImageService
}

func (service *Service) ServeWebsocket(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Print("client upgrade error: ", err)
		return
	}
	userID := RandString(5)
	log.Printf("Assigned connecting user id: %s", userID)
	client := &Client{
		Service: service,
		ID:      userID,
		hub:     hub,
		conn:    conn,
		send:    make(chan []byte, 256),
	}
	client.hub.register <- client
	go client.writePump()
	go client.readPump()
	client.send <- []byte(`["auth",{"success":true,"is_moderator":true,"username":"testing"}]`)
}

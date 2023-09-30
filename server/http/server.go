package http

import (
	"bytes"
	"image/png"
	"net/http"

	"github.com/liamcottam/place/server/database"
	"github.com/liamcottam/place/server/websocket"
)

// Server implements the portainer.Server interface
type Server struct {
	BindAddress      string
	UserService      *database.UserService
	ImageService     *database.ImageService
	WebsocketService *websocket.Service
	Hub              *websocket.Hub
}

// ServeImage - Should I move this into image_service?
func (server *Server) ServeImage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	buffer := bytes.NewBuffer(nil)
	png.Encode(buffer, server.ImageService.Image)
	w.Write(buffer.Bytes())
}

var (
	boardInfo = []byte(`{"width":1250,"height":1250,"custom_colors":true,"palette":["#FFFFFF","#DAD45E","#6DC2CA","#D2AA99","#6DAA2C","#8595A1","#D27D2C","#597DCE","#757161","#D04648","#346524","#854C30","#4E4A4F","#30346D","#442434","#140C1C"]}`)
)

// ServeBoardInfo sends the board information, width and height being the most important
func ServeBoardInfo(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write(boardInfo)
}

// Start starts the HTTP server
func (server *Server) Start() error {
	server.WebsocketService = &websocket.Service{
		UserService:  server.UserService, // TODO: Pointers for days, seperate this out
		ImageService: server.ImageService,
	}

	http.Handle("/", http.FileServer(http.Dir("dist")))
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		server.WebsocketService.ServeWebsocket(server.Hub, w, r)
	})
	http.HandleFunc("/boardinfo", ServeBoardInfo)
	http.HandleFunc("/board", server.ServeImage)
	return http.ListenAndServe(server.BindAddress, nil)
}

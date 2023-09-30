package websocket

import (
	"encoding/json"
	"fmt"
	"image/color"
	"log"

	"github.com/go-playground/colors"
)

//["place", {x: 0, y: 0, color: "#6DAA2C"}]

// PlaceRequest is how place requests are constructed
type PlaceRequest struct {
	X     int    `json:"x"`
	Y     int    `json:"y"`
	Color string `json:"color"`
}

// PlaceEmit is how we emit a successful place
type PlaceEmit struct {
	ID    string `json:"id"`
	X     int    `json:"x"`
	Y     int    `json:"y"`
	Color string `json:"color"`
}

// RGBAColor represents an RGBA color
type RGBAColor struct {
	R uint8
	G uint8
	B uint8
	A float64
}

const (
	hexFormat = "#%02x%02x%02x"
)

// ParsePlaceRequest is called by client.go to handle a place request
func ParsePlaceRequest(c *Client, props []json.RawMessage) {
	request := PlaceRequest{}
	err := json.Unmarshal(props[1], &request)
	if err != nil {
		log.Printf("failed to parse place request: %v\n", err)
		return
	}
	hex, err := colors.ParseHEX(request.Color)
	if err != nil {
		log.Printf("invalid color provided: %v\n", err)
		return
	}
	var r, g, b uint8
	fmt.Sscanf(hex.String(), hexFormat, &r, &g, &b)
	color := color.RGBA{r, g, b, 255}
	c.Service.ImageService.Place(request.X, request.Y, color)

	emit := PlaceEmit{
		ID:    c.ID,
		X:     request.X,
		Y:     request.Y,
		Color: request.Color,
	}
	mixed := []interface{}{"place", emit}
	bytes, _ := json.Marshal(mixed)
	c.hub.broadcast <- bytes
}

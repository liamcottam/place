package database

import (
	"image"
	"image/color"
	"image/draw"
	"log"
	"time"

	"gopkg.in/mgo.v2/bson"
)

type ImageService struct {
	database *Database
	Image    *image.RGBA
}

type Pixel struct {
	Username string `bson:"username"`
	IP       string `bson:"ip"`
	X        int    `bson:"xPos"`
	Y        int    `bson:"yPos"`
	ColorR   uint8  `bson:"colorR"`
	ColorG   uint8  `bson:"colorG"`
	ColorB   uint8  `bson:"colorB"`
	Anon     bool   `bson:"anon"`
}

// Validate somehow, or emit a rollback on that pixel if this fails
func UpdateDbPixel(service *ImageService, x, y int, c color.RGBA) {
	selector := bson.M{"xPos": x, "yPos": y}
	update := bson.M{"$set": bson.M{"colorR": c.R, "colorG": c.G, "colorB": c.B}}
	_, err := service.database.Database.C("pixels").Upsert(selector, update)
	if err != nil {
		log.Println(err)
	}
}

func (service *ImageService) Place(x, y int, c color.RGBA) {
	service.Image.Set(x, y, c)
	go UpdateDbPixel(service, x, y, c)
}

func (service *ImageService) LoadImage() error {
	log.Println("Loading board data...")
	start := time.Now()

	pixels := []Pixel{}
	pixelCollection := service.database.Database.C("pixels")
	err := pixelCollection.Find(nil).All(&pixels)
	if err != nil {
		return err
	}
	log.Printf("Number of pixels: %d\n", len(pixels))
	// Create a new image
	m := image.NewRGBA(image.Rect(0, 0, 1250, 1250))

	// Clear the image with white
	draw.Draw(m, m.Bounds(), &image.Uniform{color.RGBA{255, 255, 255, 255}}, image.ZP, draw.Src)

	// Iterate over the pixels from the database and update the image.
	for i := 0; i < len(pixels); i++ {
		m.Set(pixels[i].X, pixels[i].Y, color.RGBA{pixels[i].ColorR, pixels[i].ColorG, pixels[i].ColorB, 255})
	}
	service.Image = m
	elapsed := time.Since(start)
	log.Printf("Took %s to load image into buffer", elapsed)
	return nil
}

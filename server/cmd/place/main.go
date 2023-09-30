package main

import (
	"log"
	"math/rand"
	"time"

	place "github.com/liamcottam/place/server"
	"github.com/liamcottam/place/server/cli"
	"github.com/liamcottam/place/server/database"
	"github.com/liamcottam/place/server/http"
	"github.com/liamcottam/place/server/jwt"
	"github.com/liamcottam/place/server/websocket"
)

func initCLI() *place.CLIFlags {
	var cli place.CLIService = &cli.Service{}
	flags, err := cli.ParseFlags(place.APIVersion)
	if err != nil {
		log.Fatal(err)
	}

	err = cli.ValidateFlags(flags)
	if err != nil {
		log.Fatal(err)
	}
	return flags
}

func initJWTService() place.JWTService {
	// TODO: Assign from config
	jwtService, err := jwt.NewService()
	if err != nil {
		log.Fatal(err)
	}
	return jwtService
}

func initDatabaseService(flags *place.CLIFlags) *database.Database {
	database, err := database.NewService(*flags.MongoURL, *flags.MongoDB)
	if err != nil {
		log.Fatal(err)
	}
	return database
}

func main() {
	flags := initCLI()
	// jwtService := initJWTService()
	database := initDatabaseService(flags)
	defer database.Session.Close()

	rand.Seed(time.Now().UnixNano()) // Seed random with time, only used for ID generation, nothing secure
	hub := websocket.NewHub()
	go hub.Run()
	var server place.Server = &http.Server{
		BindAddress:  *flags.Addr,
		UserService:  database.UserService,
		ImageService: database.ImageService,
		Hub:          hub,
	}
	log.Printf("Starting Place API %s on %s\n", place.APIVersion, *flags.Addr)
	err := server.Start()
	if err != nil {
		log.Fatal(err)
	}
}

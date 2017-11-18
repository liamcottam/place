package database

import (
	"log"

	mgo "gopkg.in/mgo.v2"
)

// Database implements everything. TODO
type Database struct {
	Session      *mgo.Session
	Database     *mgo.Database
	UserService  *UserService
	ImageService *ImageService
}

// NewService initializes a new service. It will connect to the database or fail.
func NewService(url string, db string) (*Database, error) {
	log.Printf("Connecting to %s", url)
	session, err := mgo.Dial(url)
	if err != nil {
		return nil, err
	}
	session.SetMode(mgo.Monotonic, true)
	log.Println("Connected to database")
	database := &Database{
		Session:      session,
		Database:     session.DB(db),
		UserService:  &UserService{},
		ImageService: &ImageService{},
	}
	database.UserService.database = database
	database.ImageService.database = database
	database.UserService.EnsureIndexes()
	err = database.ImageService.LoadImage()
	if err != nil {
		return nil, err
	}
	return database, nil
}

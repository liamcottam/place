package database

import (
	"log"

	place "github.com/liamcottam/place/server"

	mgo "gopkg.in/mgo.v2"
	"gopkg.in/mgo.v2/bson"
)

type UserService struct {
	database *Database
}

// User returns a user by ID
func (service *UserService) User(ID string) (*place.User, error) {
	user := place.User{}
	err := service.database.Database.C("users").Find(bson.M{"_id": bson.ObjectIdHex(ID)}).One(&user)
	if err != nil {
		return nil, err
	}
	log.Printf("%+v\n", user)
	return &user, nil
}

// EnsureIndexes creates the indexes required
func (service *UserService) EnsureIndexes() error {
	index := mgo.Index{
		Key:    []string{"username"},
		Unique: true,
	}
	err := service.database.Database.C("users").EnsureIndex(index)
	return err
}

func (service *UserService) Login(username, password string) (*place.User, error) {
	user := place.User{}
	err := service.database.Database.C("users").Find(bson.M{"username": username}).One(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

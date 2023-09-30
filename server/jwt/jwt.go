package jwt

import (
	"fmt"
	"time"

	place "github.com/liamcottam/place/server"

	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/securecookie"
)

// Service represents a service for managing JWT tokens.
type Service struct {
	secret []byte
}

type claims struct {
	UserID   place.UserID `json:"id"`
	Username string       `json:"username"`
	jwt.StandardClaims
}

// NewService initializes a new service. It will generate a random key that will be used to sign JWT tokens.
func NewService() (*Service, error) {
	// TODO: Assign from config
	secret := securecookie.GenerateRandomKey(32)
	if secret == nil {
		return nil, place.ErrSecretGeneration
	}
	service := &Service{
		secret,
	}
	return service, nil
}

// GenerateToken generates a new JWT token.
func (service *Service) GenerateToken(data *place.TokenData) (string, error) {
	expireToken := time.Now().Add(time.Hour * 8).Unix()
	cl := claims{
		data.ID,
		data.Username,
		jwt.StandardClaims{
			ExpiresAt: expireToken,
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, cl)

	signedToken, err := token.SignedString(service.secret)
	if err != nil {
		return "", err
	}

	return signedToken, nil
}

// ParseAndVerifyToken parses a JWT token and verify its validity. It returns an error if token is invalid.
func (service *Service) ParseAndVerifyToken(token string) (*place.TokenData, error) {
	parsedToken, err := jwt.ParseWithClaims(token, &claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			msg := fmt.Errorf("Unexpected signing method: %v", token.Header["alg"])
			return nil, msg
		}
		return service.secret, nil
	})
	if err == nil && parsedToken != nil {
		if cl, ok := parsedToken.Claims.(*claims); ok && parsedToken.Valid {
			tokenData := &place.TokenData{
				ID:       place.UserID(cl.UserID),
				Username: cl.Username,
			}
			return tokenData, nil
		}
	}

	return nil, place.ErrInvalidJWTToken
}

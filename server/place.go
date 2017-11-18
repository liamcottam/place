package place

import "gopkg.in/mgo.v2/bson"

type (
	CLIFlags struct {
		Addr     *string
		MongoURL *string
		MongoDB  *string
	}

	// CLIService represents a service for managing CLI.
	CLIService interface {
		ParseFlags(version string) (*CLIFlags, error)
		ValidateFlags(flags *CLIFlags) error
	}

	// DatabaseService defines the interface to manage the data.
	DatabaseService interface {
		Open() error
		Close() error
	}

	// Server defines the interface to manage the server.
	Server interface {
		Start() error
	}

	// User represents a user account.
	User struct {
		ID       bson.ObjectId `json:"id" bson:"_id,omitempty"`
		Username string        `json:"username" bson:"username"`
		Password string        `bson:"password,omitempty"`
	}

	// UserID represents a user identifier
	UserID bson.ObjectId

	// UserService represents a service for managing user data.
	UserService interface {
		User(ID UserID) (*User, error)
		UserByUsername(username string) (*User, error)
		Users() ([]User, error)
		CreateUser(user *User) error
		/* UpdateUser(ID UserID, user *User) error
		DeleteUser(ID UserID) error */
	}

	// TokenData represents the data embedded in a JWT token.
	TokenData struct {
		ID       UserID
		Username string
	}

	// JWTService represents a service for managing JWT tokens.
	JWTService interface {
		GenerateToken(data *TokenData) (string, error)
		ParseAndVerifyToken(token string) (*TokenData, error)
	}
)

const (
	// APIVersion is the version number of the Place API.
	APIVersion = "0.0.0-alpha"
)

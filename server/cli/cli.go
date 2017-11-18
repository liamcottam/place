package cli

import (
	"place/server"

	"gopkg.in/alecthomas/kingpin.v2"
)

// Service implements the CLIService interface
type Service struct{}

// ParseFlags parse the CLI flags and return a place.Flags struct
func (*Service) ParseFlags(version string) (*place.CLIFlags, error) {
	kingpin.Version(version)

	flags := &place.CLIFlags{
		Addr:     kingpin.Flag("bind", "Override config and assign temporary port/address").Default(defaultBindAddress).Short('p').String(),
		MongoURL: kingpin.Flag("mongo", "Override config and assign temporary mongo url").Default(defaultMongoURL).Short('u').String(),
		MongoDB:  kingpin.Flag("db", "Override config and assign temporary mongo database").Default(defaultMongoDB).Short('d').String(),
	}
	kingpin.Parse()

	return flags, nil
}

// ValidateFlags validates the values of the flags. (May potentially be used in the future)
func (*Service) ValidateFlags(flags *place.CLIFlags) error {
	return nil
}

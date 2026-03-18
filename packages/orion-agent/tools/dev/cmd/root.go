package cmd

import (
	"os"

	"orion-dev/proc"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "orion-dev",
	Short: "Orion development & testing CLI",
	Long: proc.BoldColor.Sprint("orion-dev") + proc.DimColor.Sprint(" — development & testing CLI for Orion") + `

Manages browser, server, and extension processes for local development and testing.`,
	CompletionOptions: cobra.CompletionOptions{DisableDefaultCmd: true},
	SilenceUsage:      true,
	SilenceErrors:     true,
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

// Package nak provides a wrapper around the nak CLI for Nostr operations.
package nak

import (
	"bytes"
	"fmt"
	"os/exec"
	"strings"
)

// Nak wraps the nak CLI binary.
type Nak struct {
	path string
}

// New creates a new Nak wrapper.
func New(path string) *Nak {
	return &Nak{path: path}
}

// Run executes a nak command with the given arguments.
func (n *Nak) Run(args ...string) (string, error) {
	cmd := exec.Command(n.path, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		errMsg := stderr.String()
		if errMsg == "" {
			errMsg = err.Error()
		}
		return "", fmt.Errorf("nak error: %s", strings.TrimSpace(errMsg))
	}

	return strings.TrimSpace(stdout.String()), nil
}

// RunWithStdin executes a nak command with stdin input.
func (n *Nak) RunWithStdin(stdin string, args ...string) (string, error) {
	cmd := exec.Command(n.path, args...)
	cmd.Stdin = strings.NewReader(stdin)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		errMsg := stderr.String()
		if errMsg == "" {
			errMsg = err.Error()
		}
		return "", fmt.Errorf("nak error: %s", strings.TrimSpace(errMsg))
	}

	return strings.TrimSpace(stdout.String()), nil
}

// Version returns the nak version.
func (n *Nak) Version() (string, error) {
	return n.Run("--version")
}

// Path returns the path to the nak binary.
func (n *Nak) Path() string {
	return n.path
}

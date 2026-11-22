package drivers

import (
	"errors"
	"os"
	"path/filepath"
)

type KeyValueStorageDriver interface {
	Put(key string, payload []byte) error
	Get(key string) ([]byte, error)
}

type FileKvDriver struct {
	DirPath string
}

func (d FileKvDriver) Put(key string, payload []byte) error {
	mkErr := os.MkdirAll(d.DirPath, 0o755)
	wrErr := os.WriteFile(filepath.Join(d.DirPath, key+".json"), payload, 0o644)
	return errors.Join(mkErr, wrErr)
}

func (d FileKvDriver) Get(key string) ([]byte, error) {
	return os.ReadFile(filepath.Join(d.DirPath, key+".json"))
}

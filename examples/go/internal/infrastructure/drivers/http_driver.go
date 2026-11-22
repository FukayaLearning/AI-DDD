package drivers

import (
	"net/http"
	"strings"
	"time"
)

type HttpJsonDriver interface {
	PostJson(url string, bodyJson string) (*http.Response, error)
}

type NetHttpJsonDriver struct {
	Client *http.Client
}

func NewNetHttpJsonDriver() NetHttpJsonDriver {
	return NetHttpJsonDriver{Client: &http.Client{Timeout: 5 * time.Second}}
}

func (d NetHttpJsonDriver) PostJson(url string, bodyJson string) (*http.Response, error) {
	return d.Client.Post(url, "application/json", strings.NewReader(bodyJson))
}

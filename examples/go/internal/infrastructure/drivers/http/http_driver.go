package http

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

func NewNetHttpJsonDriver(timeout time.Duration) NetHttpJsonDriver {
	return NetHttpJsonDriver{Client: &http.Client{Timeout: timeout}}
}

func (d NetHttpJsonDriver) PostJson(url string, bodyJson string) (*http.Response, error) {
	return d.Client.Post(url, "application/json", strings.NewReader(bodyJson))
}

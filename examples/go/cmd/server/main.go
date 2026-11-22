package main

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"example.com/ordering-go/internal/application"
	"example.com/ordering-go/internal/infrastructure/acl"
	"example.com/ordering-go/internal/infrastructure/drivers"
	"example.com/ordering-go/internal/infrastructure/repository"
	"example.com/ordering-go/internal/presentation"
)

func CreateOrderingApp(dataDir, inventoryUrl, paymentUrl string) application.OrderUseCases {
	kv := drivers.FileKvDriver{DirPath: dataDir}
	httpDrv := drivers.NewNetHttpJsonDriver()
	repo := repository.NewDriverOrderRepository(kv)
	inv := acl.NewInventoryGateway(httpDrv, inventoryUrl)
	pay := acl.NewPaymentGateway(httpDrv, paymentUrl)
	return application.NewOrderApplicationService(repo, inv, pay)
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	port := envOr("PORT", "3000")
	cwd, _ := os.Getwd()
	dataDir := envOr("ORDER_DATA_DIR", filepath.Join(cwd, ".order-data"))
	invUrl := envOr("INVENTORY_URL", "http://127.0.0.1:4001/reserve")
	payUrl := envOr("PAYMENT_URL", "http://127.0.0.1:4002/charge")

	ln, err := net.Listen("tcp", "127.0.0.1:"+port)
	if err != nil {
		panic(err)
	}
	fmt.Printf("LISTENING http://%s\n", ln.Addr().String())
	_ = http.Serve(ln, presentation.NewOrderWebHandler(CreateOrderingApp(dataDir, invUrl, payUrl)))
}

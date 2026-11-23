package main

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	orderdto "example.com/ordering-go/internal/application/dtos/order"
	ordersvc "example.com/ordering-go/internal/application/services/order"
	httpdrv "example.com/ordering-go/internal/infrastructure/drivers/http"
	"example.com/ordering-go/internal/infrastructure/drivers/kv"
	inventorygw "example.com/ordering-go/internal/infrastructure/gateways/inventory"
	paymentgw "example.com/ordering-go/internal/infrastructure/gateways/payment"
	orderrepo "example.com/ordering-go/internal/infrastructure/repositories/order"
	ordercontroller "example.com/ordering-go/internal/presentation/controllers/order"
	"example.com/ordering-go/internal/presentation/i18n"
)

func CreateOrderingApp(dataDir, inventoryUrl, paymentUrl string, timeout time.Duration) orderdto.OrderUseCases {
	kvDrv := kv.FileKvDriver{DirPath: dataDir}
	httpDrv := httpdrv.NewNetHttpJsonDriver(timeout)
	repo := orderrepo.NewDriverOrderRepository(kvDrv)
	inv := inventorygw.NewInventoryGateway(httpDrv, inventoryUrl)
	pay := paymentgw.NewPaymentGateway(httpDrv, paymentUrl)
	return ordersvc.NewOrderApplicationService(repo, inv, pay)
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
	timeoutMs := 5000
	if v, err := strconv.Atoi(os.Getenv("HTTP_TIMEOUT_MS")); err == nil && v > 0 {
		timeoutMs = v
	}
	msg := i18n.JaMessages
	if os.Getenv("APP_LOCALE") == "en" {
		msg = i18n.EnMessages
	}

	ln, err := net.Listen("tcp", "127.0.0.1:"+port)
	if err != nil {
		panic(err)
	}
	fmt.Printf("LISTENING http://%s\n", ln.Addr().String())
	_ = http.Serve(ln, ordercontroller.NewOrderWebHandler(CreateOrderingApp(dataDir, invUrl, payUrl, time.Duration(timeoutMs)*time.Millisecond), msg))
}

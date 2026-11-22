package order_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"testing"
	commands "example.com/ordering-go/internal/application/order/commands"
	"example.com/ordering-go/internal/domain/shared"
	"example.com/ordering-go/internal/presentation/web/i18n"
	weborder "example.com/ordering-go/internal/presentation/web/order"
)

type mockOrderUseCases struct {
	placeRes   shared.Result[commands.OrderSummaryDto, shared.DomainError]
	confirmRes shared.Result[commands.OrderSummaryDto, shared.DomainError]
	cancelRes  shared.Result[commands.OrderSummaryDto, shared.DomainError]
	getRes     shared.Result[commands.OrderSummaryDto, shared.DomainError]
}

func (m *mockOrderUseCases) PlaceOrder(commands.PlaceOrderCommand) shared.Result[commands.OrderSummaryDto, shared.DomainError] { return m.placeRes }
func (m *mockOrderUseCases) ConfirmOrder(string) shared.Result[commands.OrderSummaryDto, shared.DomainError] { return m.confirmRes }
func (m *mockOrderUseCases) CancelOrder(string) shared.Result[commands.OrderSummaryDto, shared.DomainError] { return m.cancelRes }
func (m *mockOrderUseCases) GetOrder(string) shared.Result[commands.OrderSummaryDto, shared.DomainError] { return m.getRes }

func runBrowser(t *testing.T, actions []map[string]any) {
	t.Helper()
	raw, _ := json.Marshal(actions)
	if out, err := exec.Command("node", "../../../../scripts/browser_driver.mjs", string(raw)).CombinedOutput(); err != nil {
		t.Fatalf("browser test failed: %v\n%s", err, string(out))
	}
}

// UT-ORD-027, UT-ORD-028, UT-ORD-029, UT-ORD-030, UT-ORD-031
func TestUT_ORD_027_PresentationWebUIWithBrowser(t *testing.T) {
	draft := commands.OrderSummaryDto{
		OrderId: "ORD-WEB-1", CustomerId: "CUST-9", Status: shared.StatusDraft,
		Total: shared.Money{Amount: 2400, Currency: shared.CurrencyJPY},
		Lines: []commands.OrderLineDto{{ProductId: "BOOK-A", Quantity: 2, UnitPrice: shared.Money{Amount: 1200, Currency: shared.CurrencyJPY}}},
	}
	confirmed := draft; confirmed.Status = shared.StatusConfirmed
	cancelled := draft; cancelled.Status = shared.StatusCancelled

	uc := &mockOrderUseCases{
		placeRes:   shared.Failure[commands.OrderSummaryDto, shared.DomainError](shared.NewDomainError("EMPTY_ORDER_LINES", "invalid lines")),
		confirmRes: shared.Success[commands.OrderSummaryDto, shared.DomainError](confirmed),
		cancelRes:  shared.Success[commands.OrderSummaryDto, shared.DomainError](cancelled),
		getRes:     shared.Success[commands.OrderSummaryDto, shared.DomainError](draft),
	}
	srv := httptest.NewServer(weborder.NewOrderWebHandler(uc, i18n.EnMessages))
	defer srv.Close()

	runBrowser(t, []map[string]any{
		{"type": "goto", "url": srv.URL + "/"},
		{"type": "fill", "selector": "input[name='orderId']", "value": "ORD-WEB-1"},
		{"type": "fill", "selector": "input[name='customerId']", "value": "CUST-9"},
		{"type": "fill", "selector": "input[name='productId']", "value": "BOOK-A"},
		{"type": "click", "selector": "[data-testid='place-order-btn']"},
		{"type": "assertText", "selector": "[data-testid='error-banner']", "expected": "EMPTY_ORDER_LINES: invalid lines"},
	})

	uc.placeRes = shared.Success[commands.OrderSummaryDto, shared.DomainError](draft)
	runBrowser(t, []map[string]any{
		{"type": "goto", "url": srv.URL + "/"},
		{"type": "fill", "selector": "input[name='orderId']", "value": "ORD-WEB-1"},
		{"type": "fill", "selector": "input[name='customerId']", "value": "CUST-9"},
		{"type": "fill", "selector": "input[name='productId']", "value": "BOOK-A"},
		{"type": "click", "selector": "[data-testid='place-order-btn']"},
		{"type": "assertText", "selector": "[data-testid='order-status']", "expected": "Draft"},
	})

	uc.confirmRes = shared.Failure[commands.OrderSummaryDto, shared.DomainError](shared.NewDomainError("INSUFFICIENT_STOCK", "out of stock"))
	runBrowser(t, []map[string]any{
		{"type": "goto", "url": srv.URL + "/orders/ORD-WEB-1"},
		{"type": "click", "selector": "[data-testid='confirm-btn']"},
		{"type": "assertText", "selector": "[data-testid='error-banner']", "expected": "INSUFFICIENT_STOCK: out of stock"},
	})

	uc.confirmRes = shared.Success[commands.OrderSummaryDto, shared.DomainError](confirmed)
	runBrowser(t, []map[string]any{
		{"type": "goto", "url": srv.URL + "/orders/ORD-WEB-1"},
		{"type": "click", "selector": "[data-testid='confirm-btn']"},
		{"type": "assertText", "selector": "[data-testid='order-status']", "expected": "Confirmed"},
		{"type": "assertDisabled", "selector": "[data-testid='confirm-btn']", "expected": true},
	})

	uc.getRes = shared.Success[commands.OrderSummaryDto, shared.DomainError](confirmed)
	uc.cancelRes = shared.Failure[commands.OrderSummaryDto, shared.DomainError](shared.NewDomainError("REPOSITORY_ERROR", "db busy"))
	runBrowser(t, []map[string]any{
		{"type": "goto", "url": srv.URL + "/orders/ORD-WEB-1"},
		{"type": "click", "selector": "[data-testid='cancel-btn']"},
		{"type": "assertText", "selector": "[data-testid='error-banner']", "expected": "REPOSITORY_ERROR: db busy"},
	})

	uc.cancelRes = shared.Success[commands.OrderSummaryDto, shared.DomainError](cancelled)
	runBrowser(t, []map[string]any{
		{"type": "goto", "url": srv.URL + "/orders/ORD-WEB-1"},
		{"type": "click", "selector": "[data-testid='cancel-btn']"},
		{"type": "assertText", "selector": "[data-testid='order-status']", "expected": "Cancelled"},
		{"type": "assertDisabled", "selector": "[data-testid='cancel-btn']", "expected": true},
	})

	uc.getRes = shared.Failure[commands.OrderSummaryDto, shared.DomainError](shared.NewDomainError("ORDER_NOT_FOUND", "missing"))
	runBrowser(t, []map[string]any{
		{"type": "goto", "url": srv.URL + "/orders/UNKNOWN"},
		{"type": "assertText", "selector": "[data-testid='error-banner']", "expected": "ORDER_NOT_FOUND: missing"},
		{"type": "goto", "url": srv.URL + "/not-exist"},
		{"type": "assertText", "selector": "[data-testid='not-found']", "expected": "Page Not Found"},
	})

	for _, req := range []struct{ method, path string }{
		{http.MethodPost, "/orders/UNKNOWN/confirm"},
		{http.MethodPost, "/orders/UNKNOWN/cancel"},
		{http.MethodPost, "/unknown"},
		{http.MethodPut, "/"},
	} {
		r, _ := http.NewRequest(req.method, srv.URL+req.path, nil)
		resp, err := http.DefaultClient.Do(r)
		if err != nil || resp.StatusCode != 404 {
			t.Fatalf("expected 404 for %s %s", req.method, req.path)
		}
		_ = resp.Body.Close()
	}
}

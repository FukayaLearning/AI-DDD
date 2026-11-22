package presentation_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"testing"
	"example.com/ordering-go/internal/application"
	"example.com/ordering-go/internal/domain"
	"example.com/ordering-go/internal/presentation"
)

type mockOrderUseCases struct {
	placeRes   domain.Result[application.OrderSummaryDto, domain.DomainError]
	confirmRes domain.Result[application.OrderSummaryDto, domain.DomainError]
	cancelRes  domain.Result[application.OrderSummaryDto, domain.DomainError]
	getRes     domain.Result[application.OrderSummaryDto, domain.DomainError]
}

func (m *mockOrderUseCases) PlaceOrder(application.PlaceOrderCommand) domain.Result[application.OrderSummaryDto, domain.DomainError] { return m.placeRes }
func (m *mockOrderUseCases) ConfirmOrder(string) domain.Result[application.OrderSummaryDto, domain.DomainError] { return m.confirmRes }
func (m *mockOrderUseCases) CancelOrder(string) domain.Result[application.OrderSummaryDto, domain.DomainError] { return m.cancelRes }
func (m *mockOrderUseCases) GetOrder(string) domain.Result[application.OrderSummaryDto, domain.DomainError] { return m.getRes }

func runBrowser(t *testing.T, actions []map[string]any) {
	t.Helper()
	raw, _ := json.Marshal(actions)
	if out, err := exec.Command("node", "../../scripts/browser_driver.mjs", string(raw)).CombinedOutput(); err != nil {
		t.Fatalf("browser test failed: %v\n%s", err, string(out))
	}
}

func TestPresentationWebUIWithBrowser(t *testing.T) {
	draft := application.OrderSummaryDto{
		OrderId: "ORD-WEB-1", CustomerId: "CUST-9", Status: domain.StatusDraft,
		Total: domain.Money{Amount: 2400, Currency: domain.CurrencyJPY},
		Lines: []application.OrderLineDto{{ProductId: "BOOK-A", Quantity: 2, UnitPrice: domain.Money{Amount: 1200, Currency: domain.CurrencyJPY}}},
	}
	confirmed := draft; confirmed.Status = domain.StatusConfirmed
	cancelled := draft; cancelled.Status = domain.StatusCancelled

	uc := &mockOrderUseCases{
		placeRes:   domain.Failure[application.OrderSummaryDto, domain.DomainError](domain.NewDomainError("EMPTY_ORDER_LINES", "invalid lines")),
		confirmRes: domain.Success[application.OrderSummaryDto, domain.DomainError](confirmed),
		cancelRes:  domain.Success[application.OrderSummaryDto, domain.DomainError](cancelled),
		getRes:     domain.Success[application.OrderSummaryDto, domain.DomainError](draft),
	}
	srv := httptest.NewServer(presentation.NewOrderWebHandler(uc))
	defer srv.Close()

	runBrowser(t, []map[string]any{
		{"type": "goto", "url": srv.URL + "/"},
		{"type": "fill", "selector": "input[name='orderId']", "value": "ORD-WEB-1"},
		{"type": "fill", "selector": "input[name='customerId']", "value": "CUST-9"},
		{"type": "fill", "selector": "input[name='productId']", "value": "BOOK-A"},
		{"type": "click", "selector": "[data-testid='place-order-btn']"},
		{"type": "assertText", "selector": "[data-testid='error-banner']", "expected": "EMPTY_ORDER_LINES: invalid lines"},
	})

	uc.placeRes = domain.Success[application.OrderSummaryDto, domain.DomainError](draft)
	runBrowser(t, []map[string]any{
		{"type": "goto", "url": srv.URL + "/"},
		{"type": "fill", "selector": "input[name='orderId']", "value": "ORD-WEB-1"},
		{"type": "fill", "selector": "input[name='customerId']", "value": "CUST-9"},
		{"type": "fill", "selector": "input[name='productId']", "value": "BOOK-A"},
		{"type": "click", "selector": "[data-testid='place-order-btn']"},
		{"type": "assertText", "selector": "[data-testid='order-status']", "expected": "Draft"},
	})

	uc.confirmRes = domain.Failure[application.OrderSummaryDto, domain.DomainError](domain.NewDomainError("INSUFFICIENT_STOCK", "out of stock"))
	runBrowser(t, []map[string]any{
		{"type": "goto", "url": srv.URL + "/orders/ORD-WEB-1"},
		{"type": "click", "selector": "[data-testid='confirm-btn']"},
		{"type": "assertText", "selector": "[data-testid='error-banner']", "expected": "INSUFFICIENT_STOCK: out of stock"},
	})

	uc.confirmRes = domain.Success[application.OrderSummaryDto, domain.DomainError](confirmed)
	runBrowser(t, []map[string]any{
		{"type": "goto", "url": srv.URL + "/orders/ORD-WEB-1"},
		{"type": "click", "selector": "[data-testid='confirm-btn']"},
		{"type": "assertText", "selector": "[data-testid='order-status']", "expected": "Confirmed"},
		{"type": "assertDisabled", "selector": "[data-testid='confirm-btn']", "expected": true},
	})

	uc.getRes = domain.Success[application.OrderSummaryDto, domain.DomainError](confirmed)
	uc.cancelRes = domain.Failure[application.OrderSummaryDto, domain.DomainError](domain.NewDomainError("REPOSITORY_ERROR", "db busy"))
	runBrowser(t, []map[string]any{
		{"type": "goto", "url": srv.URL + "/orders/ORD-WEB-1"},
		{"type": "click", "selector": "[data-testid='cancel-btn']"},
		{"type": "assertText", "selector": "[data-testid='error-banner']", "expected": "REPOSITORY_ERROR: db busy"},
	})

	uc.cancelRes = domain.Success[application.OrderSummaryDto, domain.DomainError](cancelled)
	runBrowser(t, []map[string]any{
		{"type": "goto", "url": srv.URL + "/orders/ORD-WEB-1"},
		{"type": "click", "selector": "[data-testid='cancel-btn']"},
		{"type": "assertText", "selector": "[data-testid='order-status']", "expected": "Cancelled"},
		{"type": "assertDisabled", "selector": "[data-testid='cancel-btn']", "expected": true},
	})

	uc.getRes = domain.Failure[application.OrderSummaryDto, domain.DomainError](domain.NewDomainError("ORDER_NOT_FOUND", "missing"))
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

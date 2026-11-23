package ordercontroller_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"testing"

	orderdto "example.com/ordering-go/internal/application/dtos/order"
	domainorder "example.com/ordering-go/internal/domain/entities/order"
	"example.com/ordering-go/internal/domain/shared"
	sharedvo "example.com/ordering-go/internal/domain/value_objects/shared"
	ordercontroller "example.com/ordering-go/internal/presentation/controllers/order"
	"example.com/ordering-go/internal/presentation/i18n"
)

type mockOrderUseCases struct {
	placeRes   shared.Result[orderdto.OrderSummaryDto, shared.DomainError]
	confirmRes shared.Result[orderdto.OrderSummaryDto, shared.DomainError]
	cancelRes  shared.Result[orderdto.OrderSummaryDto, shared.DomainError]
	getRes     shared.Result[orderdto.OrderSummaryDto, shared.DomainError]
}

func (m *mockOrderUseCases) PlaceOrder(orderdto.PlaceOrderCommand) shared.Result[orderdto.OrderSummaryDto, shared.DomainError] {
	return m.placeRes
}
func (m *mockOrderUseCases) ConfirmOrder(string) shared.Result[orderdto.OrderSummaryDto, shared.DomainError] {
	return m.confirmRes
}
func (m *mockOrderUseCases) CancelOrder(string) shared.Result[orderdto.OrderSummaryDto, shared.DomainError] {
	return m.cancelRes
}
func (m *mockOrderUseCases) GetOrder(string) shared.Result[orderdto.OrderSummaryDto, shared.DomainError] {
	return m.getRes
}

func runBrowser(t *testing.T, actions []map[string]any) {
	t.Helper()
	raw, _ := json.Marshal(actions)
	if out, err := exec.Command("node", "../../../../scripts/browser_driver.mjs", string(raw)).CombinedOutput(); err != nil {
		t.Fatalf("browser test failed: %v\n%s", err, string(out))
	}
}

// UT-ORD-027, UT-ORD-028, UT-ORD-029, UT-ORD-030
func TestUT_ORD_027_PresentationWebUIWithBrowser(t *testing.T) {
	draft := orderdto.OrderSummaryDto{
		OrderId: "ORD-WEB-1", CustomerId: "CUST-9", Status: domainorder.StatusDraft,
		Total: sharedvo.Money{Amount: 2400, Currency: sharedvo.CurrencyJPY},
		Lines: []orderdto.OrderLineDto{{ProductId: "BOOK-A", Quantity: 2, UnitPrice: sharedvo.Money{Amount: 1200, Currency: sharedvo.CurrencyJPY}}},
	}
	confirmed := draft
	confirmed.Status = domainorder.StatusConfirmed
	cancelled := draft
	cancelled.Status = domainorder.StatusCancelled

	uc := &mockOrderUseCases{
		placeRes:   shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](shared.NewDomainError("EMPTY_ORDER_LINES", "invalid lines")),
		confirmRes: shared.Success[orderdto.OrderSummaryDto, shared.DomainError](confirmed),
		cancelRes:  shared.Success[orderdto.OrderSummaryDto, shared.DomainError](cancelled),
		getRes:     shared.Success[orderdto.OrderSummaryDto, shared.DomainError](draft),
	}
	srv := httptest.NewServer(ordercontroller.NewOrderWebHandler(uc, i18n.EnMessages))
	defer srv.Close()

	runBrowser(t, []map[string]any{
		{"type": "goto", "url": srv.URL + "/"},
		{"type": "fill", "selector": "input[name='orderId']", "value": "ORD-WEB-1"},
		{"type": "fill", "selector": "input[name='customerId']", "value": "CUST-9"},
		{"type": "fill", "selector": "input[name='productId']", "value": "BOOK-A"},
		{"type": "click", "selector": "[data-testid='place-order-btn']"},
		{"type": "assertText", "selector": "[data-testid='error-banner']", "expected": "EMPTY_ORDER_LINES: Order must contain at least one line"},
	})

	uc.placeRes = shared.Success[orderdto.OrderSummaryDto, shared.DomainError](draft)
	runBrowser(t, []map[string]any{
		{"type": "goto", "url": srv.URL + "/"},
		{"type": "fill", "selector": "input[name='orderId']", "value": "ORD-WEB-1"},
		{"type": "fill", "selector": "input[name='customerId']", "value": "CUST-9"},
		{"type": "fill", "selector": "input[name='productId']", "value": "BOOK-A"},
		{"type": "click", "selector": "[data-testid='place-order-btn']"},
		{"type": "assertText", "selector": "[data-testid='order-status']", "expected": "Draft"},
	})

	uc.confirmRes = shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](shared.NewDomainError("INSUFFICIENT_STOCK", "out of stock"))
	runBrowser(t, []map[string]any{
		{"type": "goto", "url": srv.URL + "/orders/ORD-WEB-1"},
		{"type": "click", "selector": "[data-testid='confirm-btn']"},
		{"type": "assertText", "selector": "[data-testid='error-banner']", "expected": "INSUFFICIENT_STOCK: Insufficient stock"},
	})

	uc.confirmRes = shared.Success[orderdto.OrderSummaryDto, shared.DomainError](confirmed)
	runBrowser(t, []map[string]any{
		{"type": "goto", "url": srv.URL + "/orders/ORD-WEB-1"},
		{"type": "click", "selector": "[data-testid='confirm-btn']"},
		{"type": "assertText", "selector": "[data-testid='order-status']", "expected": "Confirmed"},
		{"type": "assertDisabled", "selector": "[data-testid='confirm-btn']", "expected": true},
	})

	uc.getRes = shared.Success[orderdto.OrderSummaryDto, shared.DomainError](confirmed)
	uc.cancelRes = shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](shared.NewDomainError("REPOSITORY_ERROR", "db busy"))
	runBrowser(t, []map[string]any{
		{"type": "goto", "url": srv.URL + "/orders/ORD-WEB-1"},
		{"type": "click", "selector": "[data-testid='cancel-btn']"},
		{"type": "assertText", "selector": "[data-testid='error-banner']", "expected": "REPOSITORY_ERROR: Failed to access order storage"},
	})

	uc.cancelRes = shared.Success[orderdto.OrderSummaryDto, shared.DomainError](cancelled)
	runBrowser(t, []map[string]any{
		{"type": "goto", "url": srv.URL + "/orders/ORD-WEB-1"},
		{"type": "click", "selector": "[data-testid='cancel-btn']"},
		{"type": "assertText", "selector": "[data-testid='order-status']", "expected": "Cancelled"},
		{"type": "assertDisabled", "selector": "[data-testid='cancel-btn']", "expected": true},
	})

	uc.getRes = shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](shared.NewDomainError("ORDER_NOT_FOUND", "missing"))
	runBrowser(t, []map[string]any{
		{"type": "goto", "url": srv.URL + "/orders/UNKNOWN"},
		{"type": "assertText", "selector": "[data-testid='error-banner']", "expected": "ORDER_NOT_FOUND: Order not found"},
		{"type": "goto", "url": srv.URL + "/not-exist"},
		{"type": "assertText", "selector": "[data-testid='not-found']", "expected": "Page Not Found"},
	})

	uc.getRes = shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](shared.NewDomainError("UNKNOWN_CODE", "raw fallback"))
	runBrowser(t, []map[string]any{
		{"type": "goto", "url": srv.URL + "/orders/ORD-WEB-1"},
		{"type": "assertText", "selector": "[data-testid='error-banner']", "expected": "UNKNOWN_CODE: raw fallback"},
	})

	uc.confirmRes = shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](shared.NewDomainError("ORDER_NOT_FOUND", "missing"))
	uc.cancelRes = shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](shared.NewDomainError("ORDER_NOT_FOUND", "missing"))

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

// UT-ORD-031
func TestUT_ORD_031_JaLocalizedBrowser(t *testing.T) {
	draft := orderdto.OrderSummaryDto{
		OrderId: "ORD-WEB-1", CustomerId: "CUST-9", Status: domainorder.StatusDraft,
		Total: sharedvo.Money{Amount: 2400, Currency: sharedvo.CurrencyJPY},
		Lines: []orderdto.OrderLineDto{{ProductId: "BOOK-A", Quantity: 2, UnitPrice: sharedvo.Money{Amount: 1200, Currency: sharedvo.CurrencyJPY}}},
	}
	uc := &mockOrderUseCases{
		getRes: shared.Success[orderdto.OrderSummaryDto, shared.DomainError](draft),
	}
	srv := httptest.NewServer(ordercontroller.NewOrderWebHandler(uc, i18n.JaMessages))
	defer srv.Close()

	runBrowser(t, []map[string]any{
		{"type": "goto", "url": srv.URL + "/"},
		{"type": "assertAttr", "selector": "html", "attr": "lang", "expected": "ja"},
		{"type": "assertText", "selector": "h1", "expected": "注文作成"},
		{"type": "assertText", "selector": "[data-testid='place-order-btn']", "expected": "注文を確定する"},
		{"type": "goto", "url": srv.URL + "/orders/ORD-WEB-1"},
		{"type": "assertAttr", "selector": "html", "attr": "lang", "expected": "ja"},
		{"type": "assertText", "selector": "h1", "expected": "注文 ORD-WEB-1"},
		{"type": "assertText", "selector": "[data-testid='confirm-btn']", "expected": "注文承認"},
		{"type": "assertText", "selector": "[data-testid='cancel-btn']", "expected": "注文取消"},
		{"type": "goto", "url": srv.URL + "/not-exist"},
		{"type": "assertText", "selector": "[data-testid='not-found']", "expected": "ページが見つかりません"},
	})
}

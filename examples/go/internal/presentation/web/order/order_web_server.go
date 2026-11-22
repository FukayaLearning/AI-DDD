package order

import (
	"fmt"
	"html"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	commands "example.com/ordering-go/internal/application/order/commands"
	"example.com/ordering-go/internal/domain/shared"
	"example.com/ordering-go/internal/presentation/web/i18n"
)

func renderLayout(locale, title, content string) string {
	return fmt.Sprintf("<!doctype html><html lang='%s'><head><meta charset='utf-8'><title>%s</title></head><body><main>%s</main></body></html>", html.EscapeString(locale), html.EscapeString(title), content)
}

func RenderCreateOrderPage(err *shared.DomainError, msg i18n.OrderMessages) string {
	banner := ""
	if err != nil {
		banner = fmt.Sprintf("<div data-testid='error-banner'>%s: %s</div>", html.EscapeString(err.Code), html.EscapeString(err.Message))
	}
	return renderLayout(msg.Locale, msg.PlaceOrderTitle, fmt.Sprintf(`<h1>%s</h1>%s
<form method="POST" action="/orders">
  <input name="orderId" placeholder="Order ID" />
  <input name="customerId" placeholder="Customer ID" />
  <input name="productId" placeholder="Product ID" />
  <input name="quantity" type="number" value="1" />
  <input name="unitAmount" type="number" value="1000" />
  <select name="currency"><option value="JPY">JPY</option><option value="USD">USD</option></select>
  <button type="submit" data-testid="place-order-btn">Place Order</button>
</form>`, banner))
}

func RenderOrderDetailPage(order commands.OrderSummaryDto, err *shared.DomainError, msg i18n.OrderMessages) string {
	banner := ""
	if err != nil {
		banner = fmt.Sprintf("<div data-testid='error-banner'>%s: %s</div>", html.EscapeString(err.Code), html.EscapeString(err.Message))
	}
	var rows strings.Builder
	for _, l := range order.Lines {
		rows.WriteString(fmt.Sprintf("<tr><td>%s</td><td>%d</td><td>%d %s</td></tr>", html.EscapeString(l.ProductId), l.Quantity, l.UnitPrice.Amount, l.UnitPrice.Currency))
	}
	confirmDisabled := ""
	if order.Status != shared.StatusDraft {
		confirmDisabled = " disabled"
	}
	cancelDisabled := ""
	if order.Status == shared.StatusCancelled {
		cancelDisabled = " disabled"
	}
	oid := html.EscapeString(order.OrderId)
	return renderLayout("Order "+order.OrderId, fmt.Sprintf(`<h1>Order %s</h1>%s
<p>Customer: <span data-testid="customer-id">%s</span></p>
<p>Status: <span data-testid="order-status">%s</span></p>
<p>Total: <span data-testid="order-total">%d %s</span></p>
<table><tbody data-testid="order-lines">%s</tbody></table>
<form method="POST" action="/orders/%s/confirm"><button type="submit" data-testid="confirm-btn"%s>Confirm Order</button></form>
<form method="POST" action="/orders/%s/cancel"><button type="submit" data-testid="cancel-btn"%s>Cancel Order</button></form>`,
		oid, banner, html.EscapeString(order.CustomerId), order.Status, order.Total.Amount, order.Total.Currency, rows.String(), oid, confirmDisabled, oid, cancelDisabled))
}

// @implements REQ-ORD-004
func NewOrderWebHandler(useCases commands.OrderUseCases, msg i18n.OrderMessages) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if r.Method == http.MethodGet {
			if r.URL.Path == "/" {
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(RenderCreateOrderPage(nil, msg)))
				return
			}
			if strings.HasPrefix(r.URL.Path, "/orders/") && !strings.Contains(strings.TrimPrefix(r.URL.Path, "/orders/"), "/") {
				orderId, _ := url.PathUnescape(strings.TrimPrefix(r.URL.Path, "/orders/"))
				res := useCases.GetOrder(orderId)
				if !res.Ok {
					w.WriteHeader(http.StatusNotFound)
					_, _ = w.Write([]byte(renderLayout(msg.Locale, msg.OrderNotFoundTitle, fmt.Sprintf("<div data-testid='error-banner'>%s: %s</div>", html.EscapeString(res.Error.Code), html.EscapeString(res.Error.Message)))))
					return
				}
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(RenderOrderDetailPage(res.Value, nil, msg)))
				return
			}
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(renderLayout(msg.Locale, msg.NotFoundTitle, "<p data-testid='not-found'>Page Not Found</p>")))
			return
		}

		if r.Method == http.MethodPost {
			if r.URL.Path == "/orders" {
				_ = r.ParseForm()
				qty, _ := strconv.Atoi(r.FormValue("quantity"))
				amt, _ := strconv.ParseInt(r.FormValue("unitAmount"), 10, 64)
				res := useCases.PlaceOrder(commands.PlaceOrderCommand{
					OrderId:    r.FormValue("orderId"),
					CustomerId: r.FormValue("customerId"),
					Lines: []commands.PlaceOrderLineInput{{
						ProductId:  r.FormValue("productId"),
						Quantity:   qty,
						UnitAmount: amt,
						Currency:   shared.Currency(r.FormValue("currency")),
					}},
				})
				if !res.Ok {
					w.WriteHeader(http.StatusUnprocessableEntity)
					_, _ = w.Write([]byte(RenderCreateOrderPage(res.Error, msg)))
					return
				}
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(RenderOrderDetailPage(res.Value, nil, msg)))
				return
			}
			if strings.HasPrefix(r.URL.Path, "/orders/") && strings.HasSuffix(r.URL.Path, "/confirm") {
				rawId := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/orders/"), "/confirm")
				orderId, _ := url.PathUnescape(rawId)
				res := useCases.ConfirmOrder(orderId)
				if !res.Ok {
					cur := useCases.GetOrder(orderId)
					if !cur.Ok {
						w.WriteHeader(http.StatusNotFound)
						_, _ = w.Write([]byte(renderLayout(msg.Locale, msg.OrderNotFoundTitle, fmt.Sprintf("<div data-testid='error-banner'>%s: %s</div>", html.EscapeString(res.Error.Code), html.EscapeString(res.Error.Message)))))
						return
					}
					w.WriteHeader(http.StatusUnprocessableEntity)
					_, _ = w.Write([]byte(RenderOrderDetailPage(cur.Value, res.Error, msg)))
					return
				}
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(RenderOrderDetailPage(res.Value, nil, msg)))
				return
			}
			if strings.HasPrefix(r.URL.Path, "/orders/") && strings.HasSuffix(r.URL.Path, "/cancel") {
				rawId := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/orders/"), "/cancel")
				orderId, _ := url.PathUnescape(rawId)
				res := useCases.CancelOrder(orderId)
				if !res.Ok {
					cur := useCases.GetOrder(orderId)
					if !cur.Ok {
						w.WriteHeader(http.StatusNotFound)
						_, _ = w.Write([]byte(renderLayout(msg.Locale, msg.OrderNotFoundTitle, fmt.Sprintf("<div data-testid='error-banner'>%s: %s</div>", html.EscapeString(res.Error.Code), html.EscapeString(res.Error.Message)))))
						return
					}
					w.WriteHeader(http.StatusUnprocessableEntity)
					_, _ = w.Write([]byte(RenderOrderDetailPage(cur.Value, res.Error, msg)))
					return
				}
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(RenderOrderDetailPage(res.Value, nil, msg)))
				return
			}
		}

		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(renderLayout(msg.Locale, msg.NotFoundTitle, "<p data-testid='not-found'>Page Not Found</p>")))
	})
}

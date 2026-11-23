package ordercontroller

import (
	"fmt"
	"html"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	orderdto "example.com/ordering-go/internal/application/dtos/order"
	sharedvo "example.com/ordering-go/internal/domain/value_objects/shared"
	"example.com/ordering-go/internal/presentation/i18n"
	orderview "example.com/ordering-go/internal/presentation/views/order"
)

// @implements REQ-ORD-004
func NewOrderWebHandler(useCases orderdto.OrderUseCases, msg i18n.OrderMessages) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if r.Method == http.MethodGet {
			if r.URL.Path == "/" {
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(orderview.RenderCreateOrderPage(nil, msg)))
				return
			}
			if strings.HasPrefix(r.URL.Path, "/orders/") && !strings.Contains(strings.TrimPrefix(r.URL.Path, "/orders/"), "/") {
				orderId, _ := url.PathUnescape(strings.TrimPrefix(r.URL.Path, "/orders/"))
				res := useCases.GetOrder(orderId)
				if !res.Ok {
					w.WriteHeader(http.StatusNotFound)
					_, _ = w.Write([]byte(orderview.RenderLayout(msg.Locale, msg.OrderNotFoundTitle, fmt.Sprintf("<div data-testid='error-banner'>%s: %s</div>", html.EscapeString(res.Error.Code), html.EscapeString(orderview.LocalizeError(msg, res.Error))))))
					return
				}
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(orderview.RenderOrderDetailPage(res.Value, nil, msg)))
				return
			}
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(orderview.RenderLayout(msg.Locale, msg.NotFoundTitle, fmt.Sprintf("<p data-testid='not-found'>%s</p>", html.EscapeString(msg.NotFoundBody)))))
			return
		}

		if r.Method == http.MethodPost {
			if r.URL.Path == "/orders" {
				_ = r.ParseForm()
				qty, _ := strconv.Atoi(r.FormValue("quantity"))
				amt, _ := strconv.ParseInt(r.FormValue("unitAmount"), 10, 64)
				res := useCases.PlaceOrder(orderdto.PlaceOrderCommand{
					OrderId:    r.FormValue("orderId"),
					CustomerId: r.FormValue("customerId"),
					Lines: []orderdto.PlaceOrderLineInput{{
						ProductId:  r.FormValue("productId"),
						Quantity:   qty,
						UnitAmount: amt,
						Currency:   sharedvo.Currency(r.FormValue("currency")),
					}},
				})
				if !res.Ok {
					w.WriteHeader(http.StatusUnprocessableEntity)
					_, _ = w.Write([]byte(orderview.RenderCreateOrderPage(res.Error, msg)))
					return
				}
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(orderview.RenderOrderDetailPage(res.Value, nil, msg)))
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
						_, _ = w.Write([]byte(orderview.RenderLayout(msg.Locale, msg.OrderNotFoundTitle, fmt.Sprintf("<div data-testid='error-banner'>%s: %s</div>", html.EscapeString(res.Error.Code), html.EscapeString(orderview.LocalizeError(msg, res.Error))))))
						return
					}
					w.WriteHeader(http.StatusUnprocessableEntity)
					_, _ = w.Write([]byte(orderview.RenderOrderDetailPage(cur.Value, res.Error, msg)))
					return
				}
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(orderview.RenderOrderDetailPage(res.Value, nil, msg)))
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
						_, _ = w.Write([]byte(orderview.RenderLayout(msg.Locale, msg.OrderNotFoundTitle, fmt.Sprintf("<div data-testid='error-banner'>%s: %s</div>", html.EscapeString(res.Error.Code), html.EscapeString(orderview.LocalizeError(msg, res.Error))))))
						return
					}
					w.WriteHeader(http.StatusUnprocessableEntity)
					_, _ = w.Write([]byte(orderview.RenderOrderDetailPage(cur.Value, res.Error, msg)))
					return
				}
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(orderview.RenderOrderDetailPage(res.Value, nil, msg)))
				return
			}
		}

		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(orderview.RenderLayout(msg.Locale, msg.NotFoundTitle, fmt.Sprintf("<p data-testid='not-found'>%s</p>", html.EscapeString(msg.NotFoundBody)))))
	})
}

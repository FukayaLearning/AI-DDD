package orderview

import (
	"fmt"
	"html"
	"strings"

	orderdto "example.com/ordering-go/internal/application/dtos/order"
	domainorder "example.com/ordering-go/internal/domain/entities/order"
	"example.com/ordering-go/internal/domain/shared"
	"example.com/ordering-go/internal/presentation/i18n"
)

func LocalizeError(msg i18n.OrderMessages, err *shared.DomainError) string {
	if localized, ok := msg.ErrorMessages[err.Code]; ok {
		return localized
	}
	return err.Message
}

func RenderLayout(locale, title, content string) string {
	return fmt.Sprintf("<!doctype html><html lang='%s'><head><meta charset='utf-8'><title>%s</title></head><body><main>%s</main></body></html>", html.EscapeString(locale), html.EscapeString(title), content)
}

func RenderCreateOrderPage(err *shared.DomainError, msg i18n.OrderMessages) string {
	banner := ""
	if err != nil {
		banner = fmt.Sprintf("<div data-testid='error-banner'>%s: %s</div>", html.EscapeString(err.Code), html.EscapeString(LocalizeError(msg, err)))
	}
	return RenderLayout(msg.Locale, msg.PlaceOrderTitle, fmt.Sprintf(`<h1>%s</h1>%s
<form method="POST" action="/orders">
  <input name="orderId" placeholder="Order ID" />
  <input name="customerId" placeholder="Customer ID" />
  <input name="productId" placeholder="Product ID" />
  <input name="quantity" type="number" value="1" />
  <input name="unitAmount" type="number" value="1000" />
  <select name="currency"><option value="JPY">JPY</option><option value="USD">USD</option></select>
  <button type="submit" data-testid="place-order-btn">%s</button>
</form>`, html.EscapeString(msg.PlaceOrderTitle), banner, html.EscapeString(msg.PlaceOrderButton)))
}

func RenderOrderDetailPage(order orderdto.OrderSummaryDto, err *shared.DomainError, msg i18n.OrderMessages) string {
	banner := ""
	if err != nil {
		banner = fmt.Sprintf("<div data-testid='error-banner'>%s: %s</div>", html.EscapeString(err.Code), html.EscapeString(LocalizeError(msg, err)))
	}
	var rows strings.Builder
	for _, l := range order.Lines {
		rows.WriteString(fmt.Sprintf("<tr><td>%s</td><td>%d</td><td>%d %s</td></tr>", html.EscapeString(l.ProductId), l.Quantity, l.UnitPrice.Amount, l.UnitPrice.Currency))
	}
	confirmDisabled := ""
	if order.Status != domainorder.StatusDraft {
		confirmDisabled = " disabled"
	}
	cancelDisabled := ""
	if order.Status == domainorder.StatusCancelled {
		cancelDisabled = " disabled"
	}
	oid := html.EscapeString(order.OrderId)
	return RenderLayout(msg.Locale, fmt.Sprintf("%s %s", msg.OrderPrefix, order.OrderId), fmt.Sprintf(`<h1>%s %s</h1>%s
<p>%s: <span data-testid="customer-id">%s</span></p>
<p>%s: <span data-testid="order-status">%s</span></p>
<p>%s: <span data-testid="order-total">%d %s</span></p>
<table><tbody data-testid="order-lines">%s</tbody></table>
<form method="POST" action="/orders/%s/confirm"><button type="submit" data-testid="confirm-btn"%s>%s</button></form>
<form method="POST" action="/orders/%s/cancel"><button type="submit" data-testid="cancel-btn"%s>%s</button></form>`,
		html.EscapeString(msg.OrderPrefix), oid, banner,
		html.EscapeString(msg.CustomerLabel), html.EscapeString(order.CustomerId),
		html.EscapeString(msg.StatusLabel), order.Status,
		html.EscapeString(msg.TotalLabel), order.Total.Amount, order.Total.Currency,
		rows.String(), oid, confirmDisabled, html.EscapeString(msg.ConfirmButton),
		oid, cancelDisabled, html.EscapeString(msg.CancelButton)))
}

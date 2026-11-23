package orderrepo

import (
	"encoding/json"
	"errors"
	"os"

	domainorder "example.com/ordering-go/internal/domain/entities/order"
	"example.com/ordering-go/internal/domain/shared"
	sharedvo "example.com/ordering-go/internal/domain/value_objects/shared"
	"example.com/ordering-go/internal/infrastructure/drivers/kv"
	ordermapper "example.com/ordering-go/internal/infrastructure/mappers/order"
)

type DriverOrderRepository struct {
	driver kv.KeyValueStorageDriver
}

func NewDriverOrderRepository(driver kv.KeyValueStorageDriver) *DriverOrderRepository {
	return &DriverOrderRepository{driver: driver}
}

func (r *DriverOrderRepository) Save(order domainorder.Order) shared.Result[struct{}, shared.DomainError] {
	payload, _ := json.Marshal(ordermapper.ToOrderRecord(order))
	if err := r.driver.Put(order.Id.Value, payload); err != nil {
		return shared.Failure[struct{}, shared.DomainError](shared.NewDomainError("REPOSITORY_ERROR", "Failed to save order"))
	}
	return shared.Success[struct{}, shared.DomainError](struct{}{})
}

func (r *DriverOrderRepository) FindById(orderId sharedvo.OrderId) shared.Result[domainorder.Order, shared.DomainError] {
	raw, err := r.driver.Get(orderId.Value)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return shared.Failure[domainorder.Order, shared.DomainError](shared.NewDomainError("ORDER_NOT_FOUND", "Order not found"))
		}
		return shared.Failure[domainorder.Order, shared.DomainError](shared.NewDomainError("REPOSITORY_ERROR", "Failed to read order"))
	}
	var rec ordermapper.OrderRecord
	if err := json.Unmarshal(raw, &rec); err != nil {
		return shared.Failure[domainorder.Order, shared.DomainError](shared.NewDomainError("REPOSITORY_ERROR", "Corrupted order payload"))
	}
	return ordermapper.FromOrderRecord(rec)
}

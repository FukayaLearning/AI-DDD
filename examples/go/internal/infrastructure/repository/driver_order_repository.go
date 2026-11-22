package repository

import (
	"encoding/json"
	"errors"
	"os"
	"example.com/ordering-go/internal/domain"
	"example.com/ordering-go/internal/infrastructure/drivers"
)

type DriverOrderRepository struct {
	driver drivers.KeyValueStorageDriver
}

func NewDriverOrderRepository(driver drivers.KeyValueStorageDriver) *DriverOrderRepository {
	return &DriverOrderRepository{driver: driver}
}

func (r *DriverOrderRepository) Save(order domain.Order) domain.Result[struct{}, domain.DomainError] {
	payload, _ := json.Marshal(ToOrderRecord(order))
	if err := r.driver.Put(order.Id.Value, payload); err != nil {
		return domain.Failure[struct{}, domain.DomainError](domain.NewDomainError("REPOSITORY_ERROR", "Failed to save order"))
	}
	return domain.Success[struct{}, domain.DomainError](struct{}{})
}

func (r *DriverOrderRepository) FindById(orderId domain.OrderId) domain.Result[domain.Order, domain.DomainError] {
	raw, err := r.driver.Get(orderId.Value)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return domain.Failure[domain.Order, domain.DomainError](domain.NewDomainError("ORDER_NOT_FOUND", "Order not found"))
		}
		return domain.Failure[domain.Order, domain.DomainError](domain.NewDomainError("REPOSITORY_ERROR", "Failed to read order"))
	}
	var rec OrderRecord
	if err := json.Unmarshal(raw, &rec); err != nil {
		return domain.Failure[domain.Order, domain.DomainError](domain.NewDomainError("REPOSITORY_ERROR", "Corrupted order payload"))
	}
	return FromOrderRecord(rec)
}

package domain

type DomainError struct {
	Code    string
	Message string
}

func NewDomainError(code, message string) DomainError {
	return DomainError{Code: code, Message: message}
}

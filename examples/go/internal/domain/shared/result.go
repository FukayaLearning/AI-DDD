package shared

type Result[T any, E any] struct {
	Ok    bool
	Value T
	Error *E
}

func Success[T any, E any](value T) Result[T, E] {
	return Result[T, E]{Ok: true, Value: value}
}

func Failure[T any, E any](err E) Result[T, E] {
	return Result[T, E]{Ok: false, Error: &err}
}

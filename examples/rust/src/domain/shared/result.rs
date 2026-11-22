#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DomainResult<T, E> {
    Ok(T),
    Err(E),
}

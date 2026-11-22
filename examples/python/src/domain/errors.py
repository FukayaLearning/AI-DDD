from dataclasses import dataclass


@dataclass(frozen=True)
class DomainError:
    code: str
    message: str

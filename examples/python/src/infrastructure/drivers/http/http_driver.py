from dataclasses import dataclass
from typing import Protocol
import urllib.error
import urllib.request


@dataclass(frozen=True)
class RawHttpResponse:
    status: int
    body_text: str


class HttpJsonDriver(Protocol):
    def post_json(self, url: str, body_json: str) -> RawHttpResponse: ...


class UrllibHttpJsonDriver:
    def __init__(self, timeout_sec: float = 5.0) -> None:
        self._timeout_sec = timeout_sec

    def post_json(self, url: str, body_json: str) -> RawHttpResponse:
        req = urllib.request.Request(
            url,
            data=body_json.encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self._timeout_sec) as resp:
                return RawHttpResponse(status=resp.status, body_text=resp.read().decode("utf-8"))
        except urllib.error.HTTPError as err:
            return RawHttpResponse(status=err.code, body_text=err.read().decode("utf-8"))

import pathlib
from typing import Protocol


class KeyValueStorageDriver(Protocol):
    def put(self, key: str, json_payload: str) -> None: ...
    def get(self, key: str) -> str: ...


class FileKvDriver:
    def __init__(self, dir_path: str) -> None:
        self._dir_path = pathlib.Path(dir_path)

    def put(self, key: str, json_payload: str) -> None:
        self._dir_path.mkdir(parents=True, exist_ok=True)
        (self._dir_path / f"{key}.json").write_text(json_payload, encoding="utf-8")

    def get(self, key: str) -> str:
        return (self._dir_path / f"{key}.json").read_text(encoding="utf-8")

"""Persist sanitized verifier JSON rows immediately, including before failure."""
import json
import os
from pathlib import Path
import sys
from typing import Iterable


def record(stream: Iterable[str], destination: Path) -> None:
    # Create with private permissions atomically; never truncate existing evidence.
    descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w', encoding='utf8') as output:
        for line in stream:
            row = json.loads(line)
            encoded = json.dumps(row) + '\n'
            output.write(encoded)
            output.flush()
            os.fsync(output.fileno())
            print(encoded, end='', flush=True)


if __name__ == '__main__': record(sys.stdin, Path(sys.argv[1]))

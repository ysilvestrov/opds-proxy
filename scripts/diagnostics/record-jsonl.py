"""Persist sanitized verifier JSON rows immediately, including before failure."""
import json
import os
from pathlib import Path
import sys


def record(stream, destination):
    with Path(destination).open('x', encoding='utf8') as output:
        os.chmod(destination, 0o600)
        for line in stream:
            row = json.loads(line)
            encoded = json.dumps(row) + '\n'
            output.write(encoded)
            output.flush()
            os.fsync(output.fileno())
            print(encoded, end='', flush=True)


if __name__ == '__main__':
    record(sys.stdin, sys.argv[1])


import json, logging, os
from threading import Lock

logger = logging.getLogger(__name__)

class JsonDB:
    def __init__(self, path):
        self.path = path
        self.lock = Lock()
        if not os.path.exists(path):
            with open(path, "w") as f:
                json.dump([], f)

    def read(self):
        with self.lock:
            with open(self.path, "r") as f:
                try:
                    data = json.load(f)
                    if not isinstance(data, list):
                        logger.error("Corrupted DB file %s (expected list) — returning empty list", self.path)
                        return []
                    return data
                except json.JSONDecodeError:
                    logger.error("Corrupted JSON in %s — returning empty list", self.path)
                    return []

    def write(self, data):
        with self.lock:
            with open(self.path, "w") as f:
                json.dump(data, f, indent=2)

    def append(self, item):
        data = self.read()
        data.append(item)
        self.write(data)

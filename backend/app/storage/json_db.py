
import json, os
from threading import Lock

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
                return json.load(f)

    def write(self, data):
        with self.lock:
            with open(self.path, "w") as f:
                json.dump(data, f, indent=2)

    def append(self, item):
        data = self.read()
        data.append(item)
        self.write(data)

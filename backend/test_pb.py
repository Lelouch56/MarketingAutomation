import json
from app.storage.json_db import JsonDB
from app.core.integrations import PhantomBusterConfig, search_phantombuster_prospects, _pb_launch, _pb_poll

settings_db = JsonDB("app/data/settings.json")
settings = settings_db.read()

pb_key = settings.get("phantombuster_api_key")
search_id = settings.get("phantombuster_search_phantom_id")
cookie = settings.get("linkedin_session_cookie")

if not pb_key or not search_id:
    print("Missing API key or search phantom ID in settings.")
    exit(1)

config = PhantomBusterConfig(
    api_key=pb_key,
    search_phantom_id=search_id,
    connection_phantom_id="dummy",
    session_cookie=cookie,
)

print(f"Testing PB Search Export with agent ID: {config.search_phantom_id}")

try:
    print("Launching phantom...")
    prospects = search_phantombuster_prospects(config, ["Agoda"])
    print(f"Found {len(prospects)} prospects.")
    for p in prospects[:2]:
        print(p)
except Exception as e:
    print(f"Error during search: {e}")

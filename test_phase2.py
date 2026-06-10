import time
import requests
import json

base_url = "http://localhost:8000/api/v1"
email = "test@test.com"
password = "testpass123"

# Register first
print("Registering user...")
resp = requests.post(f"{base_url}/auth/register", json={"email": email, "password": password, "full_name": "Test User"})
if resp.status_code not in (200, 201, 400): # 400 if already registered
    print("Registration failed:", resp.text)

# Login
print("Logging in...")
resp = requests.post(f"{base_url}/auth/login", json={"email": email, "password": password})
if resp.status_code != 200:
    print("Login failed:", resp.text)
    exit(1)
token = resp.json().get("access_token")
headers = {"Authorization": f"Bearer {token}"}
print("Got token")

# Submit repo for analysis
print("Submitting repo...")
resp = requests.post(
    f"{base_url}/analyses/",
    headers=headers,
    json={"repo_url": "https://github.com/pallets/flask"}
)
if resp.status_code != 201:
    print("Analysis creation failed:", resp.text)
    exit(1)

analysis_id = resp.json().get("id")
print(f"Analysis ID: {analysis_id}")

# Poll status
while True:
    resp = requests.get(f"{base_url}/analyses/{analysis_id}", headers=headers)
    data = resp.json()
    status = data.get("status")
    progress = data.get("progress")
    print(f"Status: {status}, Progress: {progress}%")
    if status == "complete":
        break
    elif status == "failed":
        print("Analysis failed:", data.get("error_message"))
        exit(1)
    time.sleep(2)

print("\n--- Metrics ---")
resp = requests.get(f"{base_url}/analyses/{analysis_id}/metrics", headers=headers)
print(json.dumps(resp.json(), indent=2))

print("\n--- Insights ---")
resp = requests.get(f"{base_url}/analyses/{analysis_id}/insights", headers=headers)
print(json.dumps(resp.json(), indent=2))

print("\n--- Summary ---")
print("Verification complete!")

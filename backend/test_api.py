import urllib.request
import time

def test():
    print("Requesting API...")
    try:
        start = time.time()
        req = urllib.request.Request("http://127.0.0.1:8000/api/constellations")
        with urllib.request.urlopen(req, timeout=5) as response:
            print(f"Status: {response.status}")
            data = response.read()
            print(f"Data length: {len(data)}")
        print(f"Finished in {time.time() - start:.2f}s")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test()

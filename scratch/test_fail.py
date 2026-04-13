import os
import mysql.connector
import time

def test_conn():
    print("Attempting to connect with NO password (simulating missing .env)...")
    start = time.time()
    try:
        db = mysql.connector.connect(
            host="localhost",
            user="root",
            password="", # WRONG
            database="CosmosDB",
            port=3306,
            connect_timeout=5
        )
        print("Connected!")
        db.close()
    except Exception as e:
        print(f"Failed in {time.time() - start:.2f}s: {e}")

if __name__ == "__main__":
    test_conn()

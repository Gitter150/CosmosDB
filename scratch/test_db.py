import os
import mysql.connector
from dotenv import load_dotenv
import time

load_dotenv()

def test_conn():
    print("Attempting to connect...")
    start = time.time()
    try:
        db = mysql.connector.connect(
            host=os.getenv("MYSQL_HOST", "localhost"),
            user=os.getenv("MYSQL_USER", "root"),
            password=os.getenv("MYSQL_PASSWORD", ""),
            database=os.getenv("MYSQL_DB_NAME", "CosmosDB"),
            port=int(os.getenv("MYSQL_PORT", "3306")),
            connect_timeout=5
        )
        print(f"Connected in {time.time() - start:.2f}s")
        cur = db.cursor()
        cur.execute("SELECT 1")
        print("Query successful")
        db.close()
    except Exception as e:
        print(f"Failed in {time.time() - start:.2f}s: {e}")

if __name__ == "__main__":
    test_conn()

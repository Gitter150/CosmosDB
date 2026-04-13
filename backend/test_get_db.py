import os
import mysql.connector
from dotenv import load_dotenv

if not os.getenv("MYSQL_HOST"):
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

def get_db():
    host = os.getenv("MYSQL_HOST", "127.0.0.1")
    if host == "localhost":
        host = "127.0.0.1"
    
    print(f"Connecting to host={host}, user={os.getenv('MYSQL_USER')}, pass={'***' if os.getenv('MYSQL_PASSWORD') else 'EMPTY'}")
    return mysql.connector.connect(
        host=host,
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DB_NAME", "CosmosDB"),
        port=int(os.getenv("MYSQL_PORT", "3306")),
        connect_timeout=5,
    )

if __name__ == "__main__":
    db = get_db()
    print("Connected.")
    db.close()

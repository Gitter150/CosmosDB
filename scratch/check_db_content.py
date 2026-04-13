import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

def check():
    try:
        db = mysql.connector.connect(
            host=os.getenv("MYSQL_HOST", "localhost"),
            user=os.getenv("MYSQL_USER", "root"),
            password=os.getenv("MYSQL_PASSWORD", ""),
            database=os.getenv("MYSQL_DB_NAME", "CosmosDB"),
            port=int(os.getenv("MYSQL_PORT", "3306"))
        )
        cur = db.cursor()
        cur.execute("SHOW TABLES")
        tables = cur.fetchall()
        print(f"Tables: {tables}")
        for (table_name,) in tables:
            cur.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cur.fetchone()[0]
            print(f"  {table_name}: {count} rows")
        db.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check()

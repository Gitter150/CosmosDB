import mysql.connector, os
from dotenv import load_dotenv

load_dotenv()
db = mysql.connector.connect(
    host=os.getenv('DB_HOST') or os.getenv('MYSQL_HOST') or 'localhost',
    user=os.getenv('DB_USER') or os.getenv('MYSQL_USER') or '',
    password=os.getenv('DB_PASSWORD') or os.getenv('MYSQL_PASSWORD') or '',
    port=int(os.getenv('DB_PORT') or os.getenv('MYSQL_PORT') or 3306),
    database=os.getenv('DB_NAME') or os.getenv('MYSQL_DB_NAME') or ''
)
cursor = db.cursor()
try:
    cursor.execute("ALTER TABLE StarSystem ADD COLUMN `ra` FLOAT CHECK (`ra` BETWEEN 0 AND 360 OR `ra` IS NULL);")
except Exception as e: print(e)
try:
    cursor.execute("ALTER TABLE StarSystem ADD COLUMN `dec` FLOAT CHECK (`dec` BETWEEN -90 AND 90 OR `dec` IS NULL);")
except Exception as e: print(e)

db.commit()
print("Alter complete")

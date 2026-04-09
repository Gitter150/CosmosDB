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

alters = [
    "ALTER TABLE Star DROP CHECK star_chk_1;",
    "ALTER TABLE Star ADD CONSTRAINT star_chk_1 CHECK (star_temp BETWEEN 0 AND 100000 OR star_temp IS NULL);",
    "ALTER TABLE Star DROP CHECK star_chk_7;",
    "ALTER TABLE Star ADD CONSTRAINT star_chk_7 CHECK (star_age BETWEEN 0 AND 100 OR star_age IS NULL);"
]

for alt in alters:
    try:
        cursor.execute(alt)
    except Exception as e:
        pass

db.commit()
print("Constraints relaxed.")

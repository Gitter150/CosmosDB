import pandas as pd
import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()
DB_USER=os.getenv("MYSQL_USER")
DB_PASSWORD=os.getenv("MYSQL_PASSWORD")
DB_HOST=os.getenv("MYSQL_HOST")
DB_PORT=os.getenv("MYSQL_PORT")
DB_NAME=os.getenv("MYSQL_DB_NAME")

db = mysql.connector.connect(
    host = DB_HOST,
    user = DB_USER,
    password = DB_PASSWORD,
    port = int(DB_PORT),
    database = DB_NAME
)

cursor = db.cursor()

df = pd.read_csv("data/Constellations.csv")
print("Loaded csv")
query = """
        INSERT INTO Constellation (
            constellation_name,
            min_ra,
            max_ra,
            min_dec,
            max_dec,
            description,
            pop_rank
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
"""

rows = []
for index, row in df.iterrows():
    constellation_name = row['constellation_name']
    min_ra = row['min_ra']
    max_ra = row['max_ra']
    min_dec = row['min_dec']
    max_dec = row['max_dec']
    desc = row['description']
    pop_rank = row['pop_rank']

    rows.append(
        (constellation_name, 
        min_ra, max_ra, min_dec, max_dec, 
        desc, pop_rank)
    )
    print("Inserted: ", rows[-1])

cursor.executemany(query, rows)
print("Executed query")
db.commit()
print("Committed to SQL engine")

cursor.close()
db.close()
print("All connections closed. Exiting.")
import test_get_db

def test_query():
    db = test_get_db.get_db()
    cur = db.cursor(dictionary=True)
    print("Running query...")
    cur.execute(
        """
        SELECT c.constellation_id, c.constellation_name, COUNT(s.system_id) AS system_count
        FROM constellation c
        LEFT JOIN starsystem s ON s.constellation_id = c.constellation_id
        GROUP BY c.constellation_id, c.constellation_name
        ORDER BY c.constellation_name
        """
    )
    rows = cur.fetchall()
    print(f"Got {len(rows)} rows.")
    cur.close()
    db.close()

if __name__ == "__main__":
    test_query()

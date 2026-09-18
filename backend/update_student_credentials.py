"""
Fast bulk update of all student credentials:
- Email: {roll_number.lower()}@gkce.edu.in
- Username: {roll_number}
- Default Password: gkce@1234
"""
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.core.security import get_password_hash

def bulk_update_credentials():
    print("=" * 65)
    print("Bulk Updating Student Credentials in Neon DB")
    print("=" * 65)

    db: Session = SessionLocal()
    t0 = time.time()
    try:
        new_pw_hash = get_password_hash("gkce@1234")

        # 1. Update students table email
        res_st = db.execute(text("""
            UPDATE students 
            SET email = LOWER(roll_number) || '@gkce.edu.in';
        """))
        st_count = res_st.rowcount
        print(f"[OK] Updated {st_count} rows in students table.")

        # 2. Update users table email, username, and hashed_password
        res_usr = db.execute(text("""
            UPDATE users 
            SET email = LOWER(students.roll_number) || '@gkce.edu.in',
                username = UPPER(students.roll_number),
                hashed_password = :new_pw
            FROM students 
            WHERE users.id = students.user_id;
        """), {"new_pw": new_pw_hash})
        usr_count = res_usr.rowcount
        print(f"[OK] Updated {usr_count} student accounts in users table.")

        db.commit()
        duration = round(time.time() - t0, 2)
        print(f"[SUCCESS] All student credentials updated in {duration}s!")
        print("Credentials specification:")
        print("  - Domain: @gkce.edu.in")
        print("  - Example Email: 24f85a0201@gkce.edu.in")
        print("  - Username / ID: 24F85A0201")
        print("  - Default Password: gkce@1234")
        print("=" * 65)
        return True
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Bulk update failed: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    bulk_update_credentials()

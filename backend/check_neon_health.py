import os
import sys
import time
from sqlalchemy import create_engine, text

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings

def check_health():
    print("=" * 60)
    print("GKCE Exam Cell - Neon PostgreSQL Health Check")
    print("=" * 60)
    
    raw_url = str(settings.DATABASE_URL)
    is_neon = "neon.tech" in raw_url.lower()
    
    if "@" in raw_url:
        masked = "postgresql://***:***@" + raw_url.split("@")[1]
    else:
        masked = raw_url
    print(f"Target Endpoint : {masked}")
    print(f"Is Neon Cloud   : {is_neon}")
    
    t0 = time.time()
    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    
    try:
        with engine.connect() as conn:
            connect_latency_ms = round((time.time() - t0) * 1000, 2)
            print(f"[OK] Connection Handshake Successful ({connect_latency_ms} ms)")
            
            # 1. Version Check
            t1 = time.time()
            version = conn.execute(text("SELECT version();")).scalar()
            q_latency_ms = round((time.time() - t1) * 1000, 2)
            print(f"[OK] PostgreSQL Version: {version[:70]}... ({q_latency_ms} ms)")
            
            # 2. Database Server Time
            t2 = time.time()
            server_time = conn.execute(text("SELECT NOW();")).scalar()
            time_latency_ms = round((time.time() - t2) * 1000, 2)
            print(f"[OK] Database Current Time (UTC): {server_time} ({time_latency_ms} ms)")
            
            # 3. SSL Status
            try:
                ssl_active = conn.execute(text("SHOW ssl;")).scalar()
                print(f"[OK] SSL Encryption Active: {ssl_active}")
            except Exception:
                print("[INFO] SSL status query skipped.")
                
            # 4. Connection & Transaction Health
            t3 = time.time()
            conn.execute(text("SELECT 1;"))
            ping_ms = round((time.time() - t3) * 1000, 2)
            print(f"[OK] Connection Ping Latency: {ping_ms} ms")
            
            # 5. Tables & Record Counts
            tables_query = text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name;
            """)
            tables = [r[0] for r in conn.execute(tables_query).fetchall()]
            print(f"[OK] Tables in Public Schema ({len(tables)}): {', '.join(tables)}")
            
            # Check individual table row counts
            print("\nRow Counts in Neon DB:")
            print("-" * 40)
            total_rows = 0
            for t in tables:
                try:
                    count = conn.execute(text(f'SELECT COUNT(*) FROM "{t}";')).scalar()
                    print(f"  - {t:<26}: {count} rows")
                    total_rows += count
                except Exception as e:
                    print(f"  - {t:<26}: error reading count ({e})")
            print("-" * 40)
            print(f"Total Rows Across All Tables: {total_rows}")
            
            print("\n" + "=" * 60)
            print("HEALTH STATUS: 100% HEALTHY & OPERATIONAL")
            print("=" * 60)
            return True
            
    except Exception as e:
        print("\n" + "=" * 60)
        print(f"HEALTH STATUS: UNHEALTHY - Error: {e}")
        print("=" * 60)
        return False

if __name__ == "__main__":
    success = check_health()
    sys.exit(0 if success else 1)

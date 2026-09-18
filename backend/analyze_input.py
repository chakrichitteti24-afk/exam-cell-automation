import json

with open("students_input.json", "r") as f:
    data = json.load(f)

print("Total records:", len(data))
branches = {}
rolls = []
for s in data:
    roll = s["rollNumber"].strip().upper()
    rolls.append(roll)
    bcode = roll[6:8]
    branches[bcode] = branches.get(bcode, 0) + 1

bmap = {"01": "CIVIL", "02": "EEE", "03": "MECH", "04": "ECE", "05": "CSE"}
print("Breakdown by Branch Code in Roll Number:")
for b, count in sorted(branches.items()):
    print(f"  Branch Code {b} -> {bmap.get(b, 'UNKNOWN')}: {count} students")

dupes = [r for r in set(rolls) if rolls.count(r) > 1]
print("Duplicate Roll Numbers:", dupes if dupes else "None")

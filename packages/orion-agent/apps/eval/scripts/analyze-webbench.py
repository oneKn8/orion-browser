"""
Analyze WebBench results across ALL 8 agents to stratify tasks by pass count.
Usage: python3 apps/eval/scripts/analyze-webbench.py
"""
import csv
import os
from collections import defaultdict

DATA_DIR = "apps/eval/data/webbench"

AGENTS = [
    {"file": "anthropicfinal.csv", "eval_col": "Anthropic_Eval", "name": "Anthropic CUA"},
    {"file": "skyvern2.0final.csv", "eval_col": "Skyvern2.0Eval", "name": "Skyvern 2.0"},
    {"file": "skyvern2.0browserbasefinal.csv", "eval_col": "Browserbase_SkyvernEval", "name": "Skyvern BB"},
    {"file": "openaicuafinal.csv", "eval_col": "CUAEval", "name": "OpenAI CUA"},
    {"file": "browserusefinal.csv", "eval_col": "BUEval", "name": "BrowserUse"},
    {"file": "convergencehitlfinal.csv", "eval_col": "convergence_hitl_eval", "name": "Convergence"},
    {"file": "operatorhitlfinal.csv", "eval_col": "operator_hitl_eval", "name": "Operator"},
    {"file": "rtrvrfinal.csv", "eval_col": "Human Label", "name": "RTRVR"},
]


def load_agent(agent):
    path = os.path.join(DATA_DIR, agent["file"])
    results = {}
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                task_id = int(row["ID"])
            except (ValueError, KeyError):
                continue
            eval_val = row.get(agent["eval_col"], "")
            results[task_id] = {
                "eval": eval_val,
                "difficulty": row.get("Difficulty", ""),
                "category": row.get("Category", ""),
                "task": row.get("Task", ""),
                "url": row.get("Starting URL", ""),
            }
    return results


# Load all agents
print("Loading agents...")
agent_results = {}
for agent in AGENTS:
    data = load_agent(agent)
    agent_results[agent["name"]] = data
    print(f"  {agent['name']}: {len(data)} tasks")

# ─── INDIVIDUAL AGENT STATS ──────────────────────────────────────────
print("\n" + "=" * 70)
print("INDIVIDUAL AGENT PASS RATES")
print("=" * 70)

for agent in AGENTS:
    name = agent["name"]
    data = agent_results[name]
    total = len(data)
    passed = sum(1 for r in data.values() if r["eval"] and "success" in r["eval"].lower())
    easy_total = sum(1 for r in data.values() if r["difficulty"] == "easy")
    easy_pass = sum(1 for r in data.values() if r["difficulty"] == "easy" and r["eval"] and "success" in r["eval"].lower())
    hard_total = sum(1 for r in data.values() if r["difficulty"] == "hard")
    hard_pass = sum(1 for r in data.values() if r["difficulty"] == "hard" and r["eval"] and "success" in r["eval"].lower())
    print(f"\n{name}: {passed}/{total} = {passed/total*100:.1f}%")
    if easy_total:
        print(f"  easy: {easy_pass}/{easy_total} = {easy_pass/easy_total*100:.1f}%")
    if hard_total:
        print(f"  hard: {hard_pass}/{hard_total} = {hard_pass/hard_total*100:.1f}%")

# ─── FULL-COVERAGE AGENTS (2452 tasks each) ──────────────────────────
# Anthropic CUA, Skyvern 2.0, Skyvern BB, OpenAI CUA
full_agents = ["Anthropic CUA", "Skyvern 2.0", "Skyvern BB", "OpenAI CUA"]

print("\n" + "=" * 70)
print(f"4 FULL-COVERAGE AGENTS: {', '.join(full_agents)}")
print("(each has ~2452 tasks)")
print("=" * 70)

# Collect IDs present in ALL 4 full agents
all_ids = None
for name in full_agents:
    ids = set(agent_results[name].keys())
    all_ids = ids if all_ids is None else all_ids & ids

print(f"Tasks in intersection: {len(all_ids)}")

by_pass = defaultdict(list)
for tid in sorted(all_ids):
    pass_count = 0
    info = {}
    agent_evals = {}
    for name in full_agents:
        r = agent_results[name][tid]
        is_success = "success" in r["eval"].lower() if r["eval"] else False
        if is_success:
            pass_count += 1
        agent_evals[name] = "PASS" if is_success else "FAIL"
        if not info:
            info = r
    by_pass[pass_count].append({
        "id": tid, "pass_count": pass_count,
        "difficulty": info["difficulty"], "category": info["category"],
        "task": info["task"], "url": info["url"], "agents": agent_evals,
    })

for pc in range(5):
    tasks = by_pass[pc]
    label = {0: "0/4 (ALL FAIL)", 4: "4/4 (ALL PASS)"}.get(pc, f"{pc}/4")
    easy = sum(1 for t in tasks if t["difficulty"] == "easy")
    hard = sum(1 for t in tasks if t["difficulty"] == "hard")
    cats = defaultdict(int)
    for t in tasks:
        cats[t["category"]] += 1
    urls = len(set(t["url"] for t in tasks))
    cat_str = ", ".join(f"{c}({n})" for c, n in sorted(cats.items(), key=lambda x: -x[1]))
    print(f"\n{label}: {len(tasks)} tasks")
    print(f"  easy: {easy}, hard: {hard}")
    print(f"  categories: {cat_str}")
    print(f"  unique websites: {urls}")

# ─── NOW ALSO CHECK: how many 0/4 tasks require login? ───────────────
print("\n" + "=" * 70)
print("0/4 TASKS: LOGIN vs NO-LOGIN breakdown")
print("=" * 70)

login_keywords = ["log in", "login", "sign in", "signin", "your account", "your profile",
                   "your wishlist", "your order", "your cart", "your dashboard", "your settings",
                   "your subscription", "your inbox", "your message", "your review",
                   "send a message", "post a comment", "write a review", "submit a",
                   "publish", "upload"]
zero_pass = by_pass[0]
login_tasks = []
no_login_tasks = []
for t in zero_pass:
    task_lower = t["task"].lower()
    needs_login = any(kw in task_lower for kw in login_keywords)
    if needs_login:
        login_tasks.append(t)
    else:
        no_login_tasks.append(t)

print(f"  Likely needs login: {len(login_tasks)}")
print(f"  Possibly no login:  {len(no_login_tasks)}")

print(f"\n  No-login 0/4 tasks by category:")
cats = defaultdict(int)
for t in no_login_tasks:
    cats[t["category"]] += 1
cat_str = ", ".join(f"{c}({n})" for c, n in sorted(cats.items(), key=lambda x: -x[1]))
print(f"    {cat_str}")

print(f"\n  Sample no-login 0/4 tasks:")
for t in no_login_tasks[:10]:
    print(f"    [{t['id']}] [{t['difficulty']}] [{t['category']}] {t['url']}")
    print(f"      {t['task'][:180]}")

# ─── ALSO INCLUDE THE HITL AGENTS (smaller overlap) ──────────────────
hitl_agents = ["Convergence", "Operator", "RTRVR"]
print("\n" + "=" * 70)
print(f"HITL AGENTS: {', '.join(hitl_agents)}")
print("=" * 70)

for name in hitl_agents:
    data = agent_results[name]
    total = len(data)
    passed = sum(1 for r in data.values() if r["eval"] and "success" in r["eval"].lower())
    print(f"  {name}: {passed}/{total} = {passed/total*100:.1f}%")

# See how HITL agents do on the same tasks as the 4 full agents
hitl_ids = None
for name in hitl_agents:
    ids = set(agent_results[name].keys())
    hitl_ids = ids if hitl_ids is None else hitl_ids & ids

common_hitl = all_ids & hitl_ids if hitl_ids else set()
print(f"\n  Tasks in common (all 7 agents): {len(common_hitl)}")

if common_hitl:
    by_pass_7 = defaultdict(list)
    all_7 = full_agents + hitl_agents
    for tid in sorted(common_hitl):
        pass_count = 0
        info = {}
        for name in all_7:
            r = agent_results[name].get(tid)
            if r:
                is_success = "success" in r["eval"].lower() if r["eval"] else False
                if is_success:
                    pass_count += 1
                if not info:
                    info = r
        by_pass_7[pass_count].append({"id": tid, **info})

    print("\n  7-AGENT PASS COUNT (on common subset):")
    for pc in range(8):
        if by_pass_7[pc]:
            print(f"    {pc}/7: {len(by_pass_7[pc])} tasks")

# ─── SUMMARY TABLE ───────────────────────────────────────────────────
print("\n" + "=" * 70)
print("SUMMARY FOR DATASET BUILDING")
print("=" * 70)
print(f"""
Pool sizes (4 full-coverage agents):
  0/4 (all fail):  {len(by_pass[0]):>4}  (login-required: ~{len(login_tasks)}, no-login: ~{len(no_login_tasks)})
  1/4:             {len(by_pass[1]):>4}
  2/4:             {len(by_pass[2]):>4}
  3/4:             {len(by_pass[3]):>4}
  4/4 (all pass):  {len(by_pass[4]):>4}
  ─────────────────────
  Total:           {sum(len(v) for v in by_pass.values()):>4}
""")

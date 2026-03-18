"""
Analyze how many WebBench tasks require authentication across ALL buckets.
Usage: python3 apps/eval/scripts/analyze-webbench-auth.py
"""
import json
import re
from collections import defaultdict

# Login/auth indicators in task text
AUTH_KEYWORDS = [
    "log in", "login", "sign in", "signin", "sign up", "signup",
    "your account", "your profile", "your wishlist", "your order",
    "your cart", "your dashboard", "your settings", "your subscription",
    "your inbox", "your message", "your review", "your playlist",
    "your favorites", "your saved", "your history", "your list",
    "your address", "your payment", "your booking", "your reservation",
    "my account", "my profile", "my wishlist", "my order", "my cart",
    "my dashboard", "my settings", "my subscription", "my inbox",
    "my message", "my review", "my playlist", "my favorites",
    "my saved", "my history", "my list", "my address", "my payment",
    "my booking", "my reservation", "my bag",
    "send a message", "post a comment", "write a review", "submit a review",
    "leave a review", "publish", "upload a", "create a playlist",
    "add to cart", "add to bag", "add to wishlist", "add to favorites",
    "save to", "bookmark", "subscribe", "unsubscribe",
    "delete your", "remove your", "delete my", "remove my",
    "edit your", "edit my", "update your", "update my",
    "change your", "change my", "modify your", "modify my",
]

# Categories that almost always need auth
WRITE_CATEGORIES = {"CREATE", "UPDATE", "DELETE"}

def needs_auth(task_text, category):
    task_lower = task_text.lower()
    # Check keywords
    for kw in AUTH_KEYWORDS:
        if kw in task_lower:
            return True, f"keyword: '{kw}'"
    # WRITE tasks that don't match keywords but still likely need auth
    # (be conservative — some CREATE tasks like "create a search filter" don't need login)
    return False, ""


# Load all datasets
for bucket in [0, 1, 2]:
    full_path = f"apps/eval/data/webbench-{bucket}of4.jsonl"
    tasks = []
    with open(full_path) as f:
        for line in f:
            tasks.append(json.loads(line))

    auth_tasks = []
    no_auth_tasks = []
    for t in tasks:
        needs, reason = needs_auth(t["query"], t["metadata"]["category"])
        if needs:
            auth_tasks.append((t, reason))
        else:
            no_auth_tasks.append(t)

    print(f"{'=' * 60}")
    print(f"BUCKET {bucket}/4: {len(tasks)} total")
    print(f"  Needs auth:    {len(auth_tasks)} ({len(auth_tasks)/len(tasks)*100:.0f}%)")
    print(f"  No auth:       {len(no_auth_tasks)} ({len(no_auth_tasks)/len(tasks)*100:.0f}%)")

    # Breakdown of no-auth tasks
    cats = defaultdict(int)
    diffs = defaultdict(int)
    domains = set()
    for t in no_auth_tasks:
        cats[t["metadata"]["category"]] += 1
        diffs[t["metadata"]["additional"]["difficulty"]] += 1
        domains.add(t["metadata"]["website"])
    cat_str = ", ".join(f"{c}({n})" for c, n in sorted(cats.items(), key=lambda x: -x[1]))
    diff_str = ", ".join(f"{d}({n})" for d, n in sorted(diffs.items(), key=lambda x: -x[1]))
    print(f"  No-auth breakdown:")
    print(f"    categories: {cat_str}")
    print(f"    difficulty: {diff_str}")
    print(f"    websites:   {len(domains)}")

    # Sample no-auth tasks
    print(f"\n  Sample no-auth tasks:")
    for t in no_auth_tasks[:8]:
        print(f"    [{t['metadata']['additional']['webbench_id']}] [{t['metadata']['category']}] {t['metadata']['website']}")
        print(f"      {t['query'][:150]}")

    # Sample auth tasks (to verify detection)
    print(f"\n  Sample auth tasks (verify detection):")
    for t, reason in auth_tasks[:5]:
        print(f"    [{t['metadata']['additional']['webbench_id']}] [{t['metadata']['category']}] {t['metadata']['website']} ({reason})")
        print(f"      {t['query'][:150]}")
    print()

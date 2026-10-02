from services.content_service import seed_default_content, get_all_content_items

print("Seeding default content...")
seed_default_content()

articles = get_all_content_items("article")
print(f"Total articles retrieved: {len(articles)}")
for idx, a in enumerate(articles):
    print(f"{idx+1}. ID: {a.get('id')} | Mood: {a.get('mood_icon')} {a.get('mood')} | Title: {a.get('title')} | Source: {a.get('source_name')}")

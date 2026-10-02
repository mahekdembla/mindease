from services.content_service import seed_default_content, get_all_content_items

print("Seeding default content...")
seed_default_content()

stories = get_all_content_items("story")
print(f"Total stories remaining: {len(stories)}")
for idx, s in enumerate(stories):
    print(f"{idx+1}. ID: {s.get('id')} | Mood: {s.get('mood_icon')} {s.get('mood')} | Title: {s.get('title')} | URL: {s.get('original_url')}")

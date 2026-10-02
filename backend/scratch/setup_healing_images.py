import shutil
import os

base_dir = r"c:\Users\VICTUS\OneDrive\Desktop\major project\mindease"
src_hero = os.path.join(base_dir, "frontend", "src", "assets", "hero.png")
target_dir = os.path.join(base_dir, "frontend", "public", "healing", "images")

os.makedirs(target_dir, exist_ok=True)

if os.path.exists(src_hero):
    for i in range(1, 6):
        target_path = os.path.join(target_dir, f"hero{i}.png")
        shutil.copy(src_hero, target_path)
        print(f"Created: {target_path}")
    print("All image files initialized successfully!")
else:
    print(f"Error: Source hero.png not found at {src_hero}")

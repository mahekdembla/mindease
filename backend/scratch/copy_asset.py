import shutil
import os

src = r"C:\Users\VICTUS\.gemini\antigravity-ide\brain\c342686a-7f54-4e53-9abe-72e434a88bcb\peaceful_woman_reflection_1789835603913.png"
dst = r"c:\Users\VICTUS\OneDrive\Desktop\major project\mindease\frontend\src\assets\peaceful_woman.png"

if os.path.exists(src):
    shutil.copy(src, dst)
    print("Copied successfully!")
else:
    print("Source file not found!")

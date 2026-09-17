from datasets import load_dataset

print("=== GoEmotions sample ===")
ds = load_dataset("google-research-datasets/go_emotions", "simplified", split="train", streaming=True)
for i, row in enumerate(ds):
    print(row)
    if i >= 2:
        break

print()
print("=== Mental Health dataset sample ===")
ds2 = load_dataset("ourafla/Mental-Health_Text-Classification_Dataset", split="train", streaming=True)
for i, row in enumerate(ds2):
    print(row)
    if i >= 2:
        break

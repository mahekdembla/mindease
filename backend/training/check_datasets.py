from datasets import load_dataset, get_dataset_split_names

print("=== GoEmotions splits ===")
print(get_dataset_split_names("google-research-datasets/go_emotions", "simplified"))

print()
print("=== Mental Health dataset splits ===")
print(get_dataset_split_names("ourafla/Mental-Health_Text-Classification_Dataset"))

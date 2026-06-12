from datasets import load_dataset

if __name__ == "__main__":
    dataset = load_dataset("imdb", split="train")

    split = dataset.train_test_split(test_size=0.2, seed=42)
    train_val = split["train"].train_test_split(test_size=0.125, seed=42)

    train_ds = train_val["train"]
    val_ds = train_val["test"]
    test_ds = split["test"]

    print(f"Train: {len(train_ds)}, Val: {len(val_ds)}, Test: {len(test_ds)}")
# Why true on-policy mode is a contract

> Bit-exact agreement needs the same kernels on both sides, so true on-policy mode works only for the models and GPUs it lists.

GRPO assumes that the probability the engine gave a token is the probability the trainer computes for it. In every healthy Qwen3-0.6B run on our GB10, the two sides disagreed by 0.013 to 0.016 per token on average. This page explains where that gap comes from, and why closing it takes a contract and not a flag.

When you finish this section, you can explain why true on-policy mode covers only some models and GPUs.

## Two programs compute the same model

The engine and the trainer hold the same weights after each update. They still run different programs. The engine is built for speed: it batches many requests, picks kernels by batch size, and fuses operations. The trainer is built for gradients: it runs a different attention kernel and a different order of operations.

Floating-point addition gives slightly different results in a different order. The same long sum, added in two orders, can differ in its last bits. Across 28 layers and a vocabulary of 151,936 tokens, those bits add up. Our reading is that this is the gap we measured.

So the gap is not a bug in either side. It is the price of two programs that each do their own job well.

## Deterministic inference fixes the wrong half

Deterministic inference makes the engine give the same result for a request, whatever the batch around it. That makes the engine repeat itself. It does not make the engine compute like the trainer.

Our runs show this directly. With deterministic inference on, two runs gave the same gap at step 0, to six decimal places, and the gap stayed at 0.015. [Section 4.5](#s-use-deterministic-inference) has the numbers.

```figure
id: fig-8-3
kind: comparison
title: Two fixes for two different halves
claim: Deterministic inference fixes the engine half, and only the true on-policy contract makes both halves the same.
caption: The trainer is on the left and the engine on the right.
```

## What the contract pins

To get a gap of exactly 0, both sides must run the same arithmetic in the same order. The contract in Miles pins that down for one family of models:

- The same attention kernel on both sides, FlashAttention 3.
- Operations that give the same result at any batch size.
- Log probabilities computed the way the engine computes its prefill.
- A profile per model, because each model has its own layers to match.

Each item removes one source of different ordering. Together they make the two programs agree bit for bit.

## Why it stops at Hopper and at Qwen3

Every pinned item is a piece of code that someone checked on specific hardware. FlashAttention 3 is built for Hopper GPUs. The batch-invariant operations and the model profile were checked for dense Qwen3 models. A new GPU or a new model needs its own kernels, checked the same way.

That is why we call it a contract and not a setting. A setting asks the code to try. A contract lists the cases where the code has been proven, and refuses the rest.

## Our gap is the floor of our setup

Our gap of about 0.015 is the floor of one setup. That setup is BF16 on both sides, SGLang kernels in the engine, and FSDP kernels in the trainer. It is not a law of RL. Other setups move it. We did not measure the changes below. They come from published work:

- **Precision.** A 2025 study ran the trainer and the engine in FP16 and reported that the gap almost went away. FP16 keeps more bits of each number than BF16, so each rounding is smaller.
- **Tensor parallel size.** A 2025 paper showed that an engine split over several GPUs adds in a different order than a trainer on one GPU. That gap stays even with batch-invariant kernels, so the tensor parallel size of the engine is a source of its own.
- **Bitwise kernels.** The same paper then made a vLLM engine and an FSDP trainer agree bit for bit, with kernels that add in one fixed tree order. In their test on Qwen3-8B, inference took 22 to 63 percent longer.

Other teams publish their healthy gaps too. Use them as a reference for the size of a working gap, not as a target for your run:

| Setup, as reported | Gap per token |
|---|---|
| Qwen3-4B on A100, the vLLM team's RL framework | about 0.011 |
| Qwen3-30B-A3B MoE on GB200, the same framework | about 0.018 |
| GLM-4.5-Air on GB200, the same framework | 0.02 to 0.03 |
| DeepSeek-V4.1 in BF16 on GB300, with Miles | 0.019 to 0.023 |
| GLM-5.3-Flash on GB300, with Miles and routing replay | 0.0068 to 0.0106, see [section 3.4](#s-train-a-moe-model) |

Our view: on a GPU outside the contract, first decide if the gap matters for your run. If it does, precision, tensor parallel size, and bitwise kernels are the levers, and each one costs speed or work. If it does not, measure the gap at step 0 and keep it inside the range of your healthy runs. Then remove the part that the sampler adds.

```takeaways
- The gap comes from two programs that add in a different order, not from a bug.
- Deterministic inference makes the engine repeat itself, and true on-policy mode makes the two sides agree.
- Our gap of about 0.015 is the floor of our BF16 setup and kernels, not a law.
```

Sources: Miles true on-policy contract, model profiles, and documentation at main 08752a12; capture/gpu/summary/miles-gb10-lab.json (runs.e6a-base, runs.e6b-det-triton, runs.e6c-det-flashinfer, runs.e6d-det-triton-repeat); Qwen3-0.6B model configuration; Defeating the Training-Inference Mismatch via FP16, arXiv 2510.26788; Deterministic Inference across Tensor Parallel Sizes, arXiv 2511.17826; vime announcement, vLLM blog, 2026-06-09; SGLang pull request 42408; Miles GLM-5.3-Flash model documentation.

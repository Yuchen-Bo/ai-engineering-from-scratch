# Fit a bigger model with FP8 weights

> FP8 weights free memory for the KV cache, and the speed change depends on what your GPU supports.

Your model fits, but only with a small KV pool. When you finish this section, you can decide between a BF16 and an FP8 checkpoint at the same memory budget.

**Our result:** on our clock-locked L4, the FP8 checkpoint gave 36 percent more output than BF16 at 32 users, at the same pool.

## Pick a checkpoint

An FP8 checkpoint stores most weights in 1 byte instead of 2. Many model makers publish one next to the BF16 model. For `Qwen/Qwen3-8B`, the FP8 checkpoint is `Qwen/Qwen3-8B-FP8`, and you serve it like any other model:

```bash
vllm serve Qwen/Qwen3-8B-FP8
```

vLLM reads the quantization from the checkpoint config, so you set no extra flag. If no FP8 checkpoint exists, vLLM can quantize a BF16 model when it loads, with `--quantization fp8_per_tensor`. We did not test that path.

## Know what your GPU runs

The L4 is an Ada GPU, SM 8.9, and it has FP8 math. So vLLM runs the matrix math of the model in FP8, and the speed can rise as well as the free memory.

GPUs before Ada, such as the A100, have no FP8 math. On those, vLLM keeps the weights in FP8 and runs a weight-only kernel. You keep the memory saving, but expect less speed gain. We did not test such a GPU.

## Count the memory it frees

The weights take close to half the memory in FP8. vLLM gives the memory that it frees to the KV pool. For `Qwen/Qwen3-8B`, each GiB of KV pool holds about 7,300 tokens in BF16, as [the FP8 KV cache page](#s-fit-more-users-with-an-fp8-kv-cache) shows.

In our runs, we held the pool at 24,096 tokens with `--num-gpu-blocks-override`, so that both runs had the same room. So we did not measure the larger pool. The gain in room comes from the bytes, not from a run.

## See what our runs show

**We measured** `Qwen/Qwen3-8B-FP8` against `Qwen/Qwen3-8B` on our L4 on 2026-10-22. We locked the SM clock at 900 MHz and ran 1 and 32 users with two seeds each.

```figure
id: fig-2-5
kind: chart
title: FP8 weights against BF16 at 32 users
claim: With the clock locked and the same KV pool, FP8 weights gave 284.7 against 208.8 output tokens per second at 32 users.
caption: Each bar is the median of two seeds. The BF16 run had a median clock of 881 MHz and the FP8 run 900 MHz. From capture/gpu/summary/l4.json.
```

| Users | Median TPOT, BF16 / FP8 | Output tok/s, BF16 / FP8 | Median SM clock, BF16 / FP8 |
|---|---|---|---|
| 32 | 119.9 / 83.8 ms | 208.8 / 284.7 | 881 / 900 MHz |
| 1 | not compared / 35.3 ms | not compared / 25.4 | 210 / 900 MHz |

At 32 users, FP8 gave 36 percent more output and cut the time per token by 30 percent. The seed ranges did not overlap for either number. The BF16 clock was about 2 percent lower, much less than the gap.

At one user, the BF16 run fell to 210 MHz, below the lock, because the GPU was hot. So we do not compare the two at one user.

## Check the accuracy

We did not measure output quality with FP8 weights. Run your own prompts on both checkpoints, and compare the answers before you go to production.

```takeaways
- Use a published FP8 checkpoint, and set no extra flag.
- On our L4 locked at 900 MHz, FP8 Qwen3-8B gave 36 percent more output at 32 users.
- The freed memory goes to the KV pool, so you also get more room.
- Check output quality on your own prompts before production.
```

Sources: capture/gpu/summary/l4.json (load.vllm-lock-b, load.vllm-lock-fp8), the vLLM source at v0.31.0 (vllm/model_executor/layers/quantization/fp8.py), vLLM documentation at v0.31.0 (docs/features/quantization/online.md).

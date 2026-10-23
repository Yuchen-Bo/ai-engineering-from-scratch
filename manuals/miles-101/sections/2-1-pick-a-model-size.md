# Pick a model size for one GPU

> The largest model you can train on one GPU is the one whose trainer copy and engine copy fit together.

When you finish this section, you can estimate the memory of a run before you start it. You can also choose the largest model that fits.

**Our result:** on one GB10 with 128 GB of shared memory, Qwen3-1.7B fit for 4 short steps with answers cut at 256 tokens. Qwen3-4B did not fit, even with those short answers. We did not train 1.7B with the 1,024-token recipe.

## Count the trainer memory first

The trainer is the large part of a colocated run. Full fine-tuning with Adam keeps the model weights, the gradients, and two optimizer values for each weight. With mixed precision that is about 16 bytes for each parameter, before activations. The engine adds its own copy of the weights and its KV cache on top.

| Model | Trainer state, estimate | Result on our GB10 |
|---|---|---|
| Qwen3-0.6B | about 10 GB | trains |
| Qwen3-1.7B | about 27 GB | fits for 4 steps at 256 tokens |
| Qwen3-4B | about 64 GB | stopped by Ray in the first step at 256 tokens, twice |
| Qwen3-8B | about 128 GB | not tried, larger than the machine |

The estimate is a lower bound. Activations, the engine, and the process overhead come on top, and the measured node memory below shows how large that overhead is.

```figure
id: fig-2-1
kind: chart
title: 1.7B fits for short steps, and 4B does not
claim: The estimated trainer state of a 4B model is about half the machine, and both 4B runs reached the Ray limit.
caption: Blue bars are estimates at 16 bytes for each parameter. Rose bars are the node memory that Ray read when it stopped each 4B run.
```

## What happened with 4B

We ran Qwen3-4B twice with short answers of 256 tokens. The first run used the engine memory fraction of 0.4. Ray stopped the trainer at 115.86 GB of 121.69 GB. The second run lowered the engine fraction to 0.2. Ray stopped it again, at 119.18 GB.

```listing
title: the second 4B run, stopped by Ray
source: capture/gpu/out-gb10/ray-oom-4b-lowmem.log
lang: text
note: The first three entries of the process list that Ray printed with the kill. The run used --sglang-mem-fraction-static 0.2.
---
(TrainerController pid=2518) Top 10 memory users: PID	MEM(GB)	COMMAND
(TrainerController pid=2518) 2523	36.75	ray::FSDPTrainRayActor.train
(TrainerController pid=2518) 3259	2.67	sglang::scheduler
(TrainerController pid=2518) 2515	1.32	ray::RolloutExecutor
```

A smaller engine did not save the run. The trainer process held almost the same memory in both runs, 36.77 and 36.75 GB. The rest of the used memory was not in the process list. Our reading: most of that rest is GPU memory that the trainer allocated. On a GB10 the GPU and the CPU use the same memory. [Section 2.3](#s-stop-ray-killing-the-job) shows why Ray sees it.

Do not raise the Ray threshold to get past this kill. At 95 percent of the node, the machine really is close to full, and a run past that point can stop the whole machine.

## Choose the size

1. Start with the smallest model that can answer your task.
2. Multiply the parameter count by 16 bytes. On our 128 GB GB10, the limit fell between 27 GB and 64 GB of this estimate. Use half of your GPU memory as a first guess.
3. Run 4 steps at your real answer length, and read the node memory in the Ray log or in `nvidia-smi`.
4. Move up one size only when the short run leaves room.

To train a model of 4B or more, you need more GPUs ([Part 6](#s-split-rollout-and-training)) or a recipe that keeps less optimizer state. We did not test either on our GB10.

```takeaways
- Estimate the trainer state at 16 bytes for each parameter before you start.
- On one 128 GB GB10, plan for 1.7B at most, and test it at your answer length.
- Do not raise the Ray threshold to pass a memory kill. Make the run smaller.
```

Sources: capture/gpu/out-gb10/ray-oom-4b.log; capture/gpu/out-gb10/ray-oom-4b-lowmem.log; capture/gpu/summary/miles-gb10-lab.json (runs.e4-0.6b, runs.e4-1.7b, excluded.e4-4b, excluded.e4-4b-lowmem).

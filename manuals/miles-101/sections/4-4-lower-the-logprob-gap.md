# Lower the log probability gap with top-p and top-k

> When you sample with top-p or top-k, Miles replays the sampled token set in the trainer, and the gap between the two sides gets smaller.

The engine samples each token from a cut-down set of the vocabulary when you use top-p or top-k. The trainer scores the same token over the full vocabulary. So the two sides give different probabilities for reasons that have nothing to do with the kernels.

When you finish this section, you can turn on sampling replay and check that it lowers the gap.

**Our result:** top-p and top-k replay lowered the median gap from 0.0153 to 0.0135, 11.5 percent, on one seed.

## Why the engine number is higher

Top-p keeps the smallest set of tokens whose probabilities add up to at least the top-p value. The engine then scales the kept probabilities so that they add up to 1 again. Take two sides that compute the same scores before the cut. For a kept token, the engine log probability is then higher than the full-vocabulary score by minus the log of the kept mass. If the kept tokens hold 0.9 of the mass, the difference is about 0.105. Top-k cuts the set in the same way, and the kernel gap comes on top of this.

That difference is not noise. It is different for each token, and it always pushes the ratio between the trainer and the engine the same way. A 2026 issue report for another RL library describes this bias in its importance-sampling ratio. Sampling replay removes it, because the trainer then scores over the same kept set.

## Turn it on

Pass the sampler settings to the run:

```bash
--rollout-top-p 0.95 --rollout-top-k 64
```

Miles turns on sampling replay by itself when `--rollout-top-p` is below 1 or `--rollout-top-k` is above 0. The engine then returns the set of tokens that each step could sample from. The trainer scores each token over that set only.

Set a positive top-k whenever you set a top-p below 1, because Miles requires both for replay. Miles refuses to start when replay is on together with a KL loss or on-policy distillation. It also refuses replay with `--recompute-logprobs-via-prefill`.

## Check the gap

Read `train/train_rollout_logprob_abs_diff` in each step. It is the mean absolute difference between the log probabilities of the trainer and of the engine.

```listing
title: the engine settings of the two runs
source: capture/gpu/out-gb10/engine-settings.txt
lang: text
note: Both runs used the same attention backend and sampler. Only the top-p and top-k flags differ.
---
run                    attention_backend  enable_deterministic_inference  sampling_backend  --rollout-top-p  --rollout-top-k
e6a-base               flashinfer         False                           flashinfer        not set          not set
e11-topp-topk          flashinfer         False                           flashinfer        0.95             64
```

| Run, 12 steps, seed 1 | Median gap | Lowest and highest step | Median reward |
|---|---|---|---|
| No top-p or top-k | 0.0153 | 0.0150 to 0.0159 | 0.66 |
| Top-p 0.95, top-k 64 | 0.0135 | 0.0128 to 0.0141 | 0.68 |

**We measured** a gap 11.5 percent lower with replay. No step of the replay run reached the lowest step of the run without it. The reward stayed in the same range.

This is one seed of 12 steps on Qwen3-0.6B. The step ranges did not overlap, so we report the direction. Run a second seed before you report the size for your own model.

```figure
id: fig-4-4
kind: chart
title: Replaying the sampled tokens lowers the gap
claim: With top-p and top-k replay, the gap was lower at every one of the 12 steps.
caption: The logprob gap per step for two 12-step runs with seed 1.
```

## What replay does not fix

Replay removes the part of the gap that comes from the sampler. Our reading is that the rest comes from the kernels: the engine and the trainer add the same numbers in a different order. [Section 4.5](#s-use-deterministic-inference) shows that deterministic inference does not remove that part. [Section 8.3](#s-why-true-on-policy-is-a-contract) explains what does.

```takeaways
- Set top-p and top-k together, and Miles replays the sampled set in the trainer.
- Compare train/train_rollout_logprob_abs_diff before and after, over the same steps and seed.
- Expect replay to lower the gap, not to close it.
```

Sources: capture/gpu/summary/miles-gb10-lab.json (runs.e6a-base, runs.e11-topp-topk); capture/gpu/out-gb10/engine-settings.txt; Miles sampling-support replay documentation and arguments at main 08752a12; TRL issue 6789.

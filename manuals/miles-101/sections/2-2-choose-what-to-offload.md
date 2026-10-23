# Choose what to offload between phases

> On one GPU the trainer and the engine take turns, and the offload settings decide what each side gives back.

When you finish this section, you can decide which memory each side gives back while the other side runs. You can also check an offload change without the heat pauses fooling you.

**Our result:** keeping the engine loaded saved 0.6 to 1.8 s of a rollout of about a minute. The 12 percent gain that an earlier run showed came from shorter answers, not from the offload setting.

## Know the two switches

`--colocate` turns on offload for both sides. Two flags turn each side off:

- `--no-offload-rollout` keeps the engine weights and its KV cache on the GPU while the trainer works. The engine starts without its memory saver.
- `--no-offload-train` keeps the trainer weights and its optimizer state on the GPU while the engine works.

`--offload-rollout-level kv_cache` gives back the KV cache and the CUDA graph memory, and keeps the engine weights.

The trainer side has its own timers. `perf/sleep_time` is the time the trainer takes to move its state to host memory after training, and Miles logs it with the next step. `perf/wake_up_time` is the time it takes to move the state back before the log probabilities. The engine release before training has no timer. The engine resume after the weight update is in `perf/finalize_and_resume_engines_time`.

## Compare one change at a time, on the same steps

We ran a same-day pair: seed 1, 12 steps, the engine memory fraction at 0.25 in both runs. The only difference was `--no-offload-rollout`.

| Setting | Clean rollout steps | Clean rollout median | Trainer offload, all steps | Trainer onload, all steps | Weight update, all steps |
|---|---|---|---|---|---|
| default offload | 4 of 12 | 60.7 s | 0.73 s | 0.76 s | 0.62 s |
| engine kept loaded | 3 of 12 | 56.7 s | 0.75 s | 0.82 s | 0.64 s |

**Clean step:** a step whose rollout overlapped no heat pause. [The lab notes](#s-ref-lab-notes) give the rule.

The two medians cover different steps, and the rollout time follows the answer length. Early steps write answers of about 800 tokens and later steps about 690. So compare the steps that were clean in both runs:

```figure
id: fig-2-2
kind: chart
title: Keeping the engine loaded saves one or two seconds
claim: On the steps that were clean in both runs, the engine kept loaded saved 0.6 to 1.8 s of each rollout.
caption: Each pair of bars is one step of the same-day pair, with nearly the same answer length in both runs.
```

**We measured** a small gain on steps 0, 1, and 8: 69.4 against 68.0 s, 58.5 against 56.7 s, and 55.8 against 55.2 s. The gain is 1 to 3 percent. The training phase did not change, because no training step escaped a pause in either run. The all-step medians were 240.4 and 239.1 s, with the pauses inside them.

The earlier lead does not hold. Our first runs showed 52.0 s against 59.1 s with the engine kept loaded. Those runs also used different memory fractions, and their clean steps were different steps.

In the earlier pair, step 10 was clean in both runs. The engine kept loaded took 46.7 s with answers of 599 tokens. The default took 56.3 s with answers of 695 tokens. The shorter answers explain that gap.

One seed is not enough to rank the two settings. A gain of one or two seconds is inside the step-to-step noise of our hot GB10.

## Decide

Keep the default offload settings. Turn the engine offload off only when you have memory to spare. With the fraction at 0.25, the engine keeps about a quarter of the GPU memory while the trainer runs. On a GB10, the trainer needs that same memory. [Section 2.1](#s-pick-a-model-size) shows how little room a 4B model leaves.

```takeaways
- Keep the default offload settings until you have measured a reason to change them.
- Compare offload settings on the same step numbers, because the rollout time follows the answer length.
- Keep the memory fraction the same when you test an offload flag.
```

Sources: capture/gpu/summary/miles-gb10-lab.json (runs.e3e-base-frac025, runs.e3f-no-offload-rollout-frac025, runs.e6a-base, runs.e3c-no-offload-rollout, runs.e3b-offload-kv, runs.e3d-no-offload-train); capture/gpu/summarize_miles.py; Miles torch_native actor sleep and wake_up at main 08752a12.

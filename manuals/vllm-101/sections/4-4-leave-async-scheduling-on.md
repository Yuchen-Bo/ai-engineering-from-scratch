# Leave async scheduling on

> Async scheduling is on by default for most generate models, and a few settings turn it off without an error.

You read about async scheduling and you want to know whether to set it. When you finish this section, you can check whether your server runs with it, and name the settings that turn it off.

**Our result:** on a throttled L4, turning async scheduling off made one user about 3 percent slower per token. Treat it as a lead, because the clock was low and we had two seeds.

## Know what it does

Without async scheduling, each step runs in order. The scheduler picks a batch, the GPU runs it, and the scheduler reads the result before it picks the next batch. While the scheduler works, the GPU waits.

With async scheduling, the scheduler picks the next batch while the GPU still runs the current one. It counts the tokens that are not sampled yet as placeholders, so it does not schedule a request past its token limit. The GPU spends less time idle between steps. [The Model Runner V2 page](#s-what-model-runner-v2-changed) explains why the new model runner makes this possible.

## Know when it is on

In vLLM 0.31.0, the setting has three values. `--async-scheduling` turns it on, `--no-async-scheduling` turns it off, and no flag lets vLLM decide. When you set no flag, vLLM turns it on unless, among other cases, one of these holds:

- The model is a pooling model, such as an embedding model.
- The speculation method is n-gram, suffix, Medusa, or MLP speculator. EAGLE, MTP, DFlash, and DSpark methods, the GPU n-gram method, and a draft model keep it on.
- Pipeline parallelism is on and the old model runner runs.
- The executor does not support it.

In those cases, vLLM turns it off. For most of them it writes a warning to the log, but for a pooling model only a debug line. The server runs, so the change is easy to miss. Read the startup log after you add a speculation method or change the parallel layout.

## See what our runs show

We ran the L4 load sweep twice on 2026-10-21 with `Qwen/Qwen3-8B`: once with no flag, and once with `--async-scheduling`. For this model with no speculation, both runs had async scheduling on. The second flag set what the default already set.

| Users | Output tok/s, no flag / flag | Median TPOT, no flag / flag | P99 ITL, no flag / flag | Median SM clock, no flag / flag |
|---|---|---|---|---|
| 1 | 13.49 / 13.25 | 60.36 / 60.37 ms | 105 / 105 ms | 1,275 / 1,268 MHz |
| 8 | 112.79 / 112.68 | 65.75 / 65.75 ms | 67 / 67 ms | 1,485 / 1,500 MHz |
| 32 | 275.14 / 275.30 | 101.79 / 102.10 ms | 613 / 613 ms | 1,275 / 1,275 MHz |
| 64 | 242.32 / 241.97 | 129.15 / 128.17 ms | 1,233 / 1,127 ms | 1,005 / 998 MHz |

At every concurrency, the seed ranges of the two runs overlapped for output, time per token, and P99 ITL. The output differed by at most 1.8 percent, and the time per token by at most 0.8 percent. The 64-user rows ran at about 1,000 MHz, at the edge of our clock floor.

So the table shows how much two runs of the same setting differ on our L4 on one day. It does not show what async scheduling is worth.

The same no-flag sweep also matched our earlier run of 2026-10-17 within 0.5 percent of output at 1, 8, 32, and 64 users. On this card, a gap of a few percent between two configs is noise unless the seed ranges separate.

## See what turning it off costs

**We measured** `--no-async-scheduling` against the default on the shared GPU of our L4 node on 2026-10-22, with `Qwen/Qwen3-8B`. That GPU held a pool of 2,928 tokens, so we tested 1 and 4 users.

| Users | Median TPOT, on / off | Output tok/s, on / off | Median SM clock, on / off | Seeds, on / off |
|---|---|---|---|---|
| 1 | 241.7 / 249.6 ms | 3.98 / 3.87 | 375 / 368 MHz | 2 / 2 |
| 4 | 272.6 / 277.2 ms | 13.02 / 12.85 | 428 / 450 MHz | 2 / 1 |

At one user, the time per token rose by 3.3 percent with async scheduling off, and the seed ranges did not overlap. That gap is larger than the 0.8 percent that two runs of one setting differed by. But that noise floor came from the other GPU at full clocks. At four users, it rose by 1.7 percent, from one seed only.

The GPU ran at 368 to 450 MHz, far below its full clock. The off runs at one user had a clock 2 percent lower, close to the size of the effect. So read this as a lead. The gain is small at these batch sizes, and we did not test it at a full clock or at high concurrency.

## Decide

Set no flag, and let vLLM choose. If you add a speculation method or pipeline parallelism, read the log for the warning. If the warning appears, measure the time per token with and without the feature, because you lose async scheduling together with the feature.

```takeaways
- Async scheduling is on by default for most generate models, so set no flag.
- N-gram, suffix, Medusa, and MLP speculator methods turn it off with only a warning.
- On our L4, two same-day runs of one setting differed by under 2 percent of output.
- Turning it off cost about 3 percent per token for one user in our throttled run.
```

Sources: capture/gpu/summary/l4.json (load.vllm-b, load.vllm-async, load.vllm), capture/gpu/summary/l4-gpu1.json (load.vllm-fast-b, load.vllm-no-async), the vLLM source at v0.31.0 (vllm/config/scheduler.py, vllm/config/vllm.py, vllm/v1/core/sched/async_scheduler.py), vLLM documentation at v0.31.0 (docs/design/model_runner_v2.md).

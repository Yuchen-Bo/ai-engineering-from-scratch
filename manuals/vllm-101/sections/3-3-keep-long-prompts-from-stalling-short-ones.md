# Keep long prompts from stalling short ones

> The batch token budget trades the first-token time against the gaps between tokens, so set it for the latency you promise.

Long prompts arrive and short requests stall behind them. When you finish this section, you can choose a batch token budget for your latency target.

**Our result:** on our DGX Spark at low load, a budget of 16,384 tokens raised the P99 ITL from 574 to 798 ms.

## Know the budget

vLLM always splits long prompts into chunks. In each step, the running streams get their next token first, and a waiting prompt fills the rest of the budget. `--max-num-batched-tokens` sets the budget. [The token budget page](#s-why-one-token-budget-replaces-a-prefill-phase) explains the order.

A larger budget lets a long prompt finish its prefill in fewer steps, so its first token comes sooner. But each of those steps takes longer, and every running stream waits for it. So at low load, a larger budget can give a faster first token and longer gaps between tokens.

## Know your default

For `vllm serve`, vLLM sets the budget from the GPU memory that it reads:

| GPU memory that vLLM reads | Default budget |
|---|---|
| 160 GiB or more | 16,384 |
| 70 GiB or more, but not an A100 | 8,192 |
| less, or unknown | 2,048 |

Our DGX Spark has 128 GB of memory that the CPU and GPU share. Its startup log still shows a budget of 2,048, the value for a small or unknown GPU. Read the value that your server uses before you change it. The `compile_ranges_endpoints` entry in the engine config line at startup gives it.

## See what our runs show

**We measured** budgets of 2,048 and 16,384 tokens on our DGX Spark with `Qwen3-30B-A3B` on 2026-10-21. The prompts had 1,024 to 4,096 tokens, and each request asked for 64 to 256 tokens. We sent requests at a fixed rate, with three seeds per point.

```figure
id: fig-3-3
kind: chart
title: a larger token budget at low load
claim: At 0.5 requests per second, a budget of 16,384 tokens raised the P99 ITL from 574 to 798 ms.
caption: Each bar is the median of three seeds. The first-token times of the two budgets overlapped across seeds. From capture/gpu/summary/gb10.json.
```

| Requests per second | Budget | Median TTFT | Median TPOT | P99 ITL |
|---|---|---|---|---|
| 0.5 | 2,048 | 1,145 ms | 149.3 ms | 574 ms |
| 0.5 | 16,384 | 906 ms | 139.4 ms | 798 ms |
| 1 | 2,048 | 454 ms | 156.4 ms | 405 ms |
| 1 | 16,384 | 477 ms | 156.9 ms | 395 ms |
| 2 | 2,048 | 560 ms | 205.5 ms | 587 ms |
| 2 | 16,384 | 595 ms | 205.1 ms | 586 ms |

At 0.5 requests per second, the larger budget raised the P99 ITL by 39 percent, and the seed ranges did not overlap. The first token came sooner, but the seed ranges of the first token overlapped. So the cost is clear, and the gain is a lead.

At 1 and 2 requests per second, the two budgets gave the same numbers within the seed ranges. At those rates, more requests share each step, so a single long prompt fills less of the budget.

Read our result as narrow: two budgets, three low rates, one model, and one machine. A 2026 study, P-PAS, found that no single fixed budget in vLLM was best at every load. A large budget gave lower latency at low pressure. A small budget won when several prefills competed with running streams. We did not measure that crossover ourselves.

The run with no budget flag matched the run with 2,048 at every rate. That agrees with the 2,048 in the startup log. All runs held a median clock of 2,398 to 2,411 MHz.

## Tune it

1. Read the budget that your server uses.
2. If the P99 ITL is too high and long prompts arrive, lower the budget. Try 2,048 if your default is larger.
3. If the first token of long prompts is too slow and the P99 ITL has room, raise it.
4. Measure at your real request rate, because the effect changed with the rate in our runs.
5. Measure again when your load changes, because the best budget moves with the load.

vLLM also has `--long-prefill-token-threshold`. It caps the tokens that one long prompt gets in a step when other requests wait. It is off by default, and we did not test it.

```takeaways
- At low load, a larger budget can give a faster first token and longer gaps between tokens.
- On our DGX Spark, 16,384 raised the P99 ITL by 39 percent at low load.
- Read the budget your server uses, because the default depends on the memory vLLM reads.
- Measure at your real request rate, and again when your load changes.
```

Sources: capture/gpu/summary/gb10.json (mixed.vllm, mixed.vllm-mnbt-2048, mixed.vllm-mnbt-16384), capture/gpu/out-gb10/server-load-vllm.log, the vLLM source at v0.31.0 (vllm/engine/arg_utils.py, vllm/config/vllm.py, vllm/config/scheduler.py, vllm/platforms/cuda.py), the 2026 study P-PAS on token budgets in vLLM.

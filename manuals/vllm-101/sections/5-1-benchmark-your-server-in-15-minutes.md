# Benchmark your server in 15 minutes

> One sweep over concurrency finds the point where your latency starts to grow, and four defaults change the result.

You changed a flag and you want to know if it helped. When you finish this section, you can run a concurrency sweep, read the knee, and avoid the four mistakes that make two runs disagree.

**Our result:** on our L4, output peaked near 275 tokens per second at 32 users and fell at 64 users.

## Run one sweep

Start the server in one terminal. In a second terminal, run the benchmark once for each concurrency:

```bash
for c in 1 2 4 8 16 32 64; do
  vllm bench serve --model Qwen/Qwen3-8B \
    --dataset-name random --random-input-len 512 --random-output-len 128 \
    --max-concurrency $c --num-prompts $((c * 4 > 16 ? c * 4 : 16)) \
    --seed $c --ignore-eos --num-warmups 2 \
    --save-result --result-filename sweep-c$c.json
done
```

Each run prints a summary with four numbers. They are the output throughput, the time to first token (TTFT), the time per output token (TPOT), and the inter-token latency (ITL). Keep the four numbers together. A throughput number alone hides the latency that your users feel.

## Read the knee

Here is the same sweep from our L4 with `Qwen/Qwen3-8B` in BF16, run on 2026-10-17. Each number is the median of three seeds. The pool was 24,096 tokens.

| Users | Output tok/s | Median TTFT | Median TPOT | P99 ITL | Median SM clock |
|---|---|---|---|---|---|
| 1 | 13.5 | 192 ms | 60.4 ms | 105 ms | 1,290 MHz |
| 8 | 112.8 | 253 ms | 65.8 ms | 68 ms | 1,470 MHz |
| 16 | 200.9 | 289 ms | 69.5 ms | 80 ms | 1,425 MHz |
| 32 | 273.9 | 1,813 ms | 102.2 ms | 619 ms | 1,275 MHz |
| 64 | 241.4 | 10,953 ms | 129.2 ms | 1,363 ms | 1,013 MHz |

Up to 16 users, each new user adds output, and the time per token rises only from 60 to 70 ms. Between 16 and 32 users, the median first token goes from 0.3 s to 1.8 s, and the P99 ITL from 80 to 619 ms. That jump is the knee. Pick your production concurrency below it.

At 64 users, the output fell. Two causes overlap here. At 640 tokens each, 64 users need more than the 24,096-token pool, so requests waited. The card was also hot, with a median clock of 1,013 MHz against 1,425 at 16 users. Our sweep cannot separate the two.

```figure
id: fig-5-1
kind: chart
title: the knee of the sweep
claim: On our L4, output rose to 275 tokens per second at 32 users and fell at 64 users, so 32 users is the knee.
caption: Users double at each step on the axis. The band spans the lowest and highest of three runs. This is the repeat sweep of 2026-10-21, which peaked at 275.1 against 273.9 in the table. From capture/gpu/summary/l4.json.
```

## Avoid the four mistakes

1. **Reusing a warm cache.** With the random dataset and a fixed seed, a second run sends the same prompts. The prefix cache then serves part of them, and the second run looks faster. The next section gives the protocol.
2. **Letting the model stop early.** Without `--ignore-eos`, some answers end before the output length. The run then measures fewer tokens than you asked for.
3. **Skipping the warmup.** The first requests after a start pay for compiled kernels and cold caches. Use `--num-warmups` or send a few requests before you measure.
4. **Ignoring the clock.** A GPU that is hot or shared runs slower. Record `nvidia-smi --query-gpu=clocks.sm,temperature.gpu --format=csv -l 1` during the run. Compare two runs only at similar clocks.

## Reset the prefix cache between runs

The prefix cache keeps the KV blocks of earlier prompts. It changes two things between runs: the speed, and sometimes the output of a greedy request. A 2026 study on vLLM 0.11 found that requests with a cache hit and requests without one gave different greedy outputs. We did not measure this effect ourselves.

Use this protocol for every run that you compare:

1. Start each run with an empty cache. Restart the server, or call `POST /reset_prefix_cache`. That route exists only with `VLLM_SERVER_DEV_MODE=1`, and a server in that mode must not be exposed.
2. Use a new `--seed` for each run, so that the random dataset sends new prompts.
3. Record the cached tokens. Read `vllm:prefix_cache_hits_total` and `vllm:prefix_cache_queries_total` before and after the run.
4. For a count on each response, start the server with `--enable-prompt-tokens-details`. Then read `usage.prompt_tokens_details.cached_tokens` in each response.
5. Write the cache setting and the cached tokens next to the result.

`vllm bench sweep serve` resets the server caches between its runs for you.

## Choose a closed loop or a fixed rate

`--max-concurrency` keeps a fixed number of users busy. When the server slows down, the users send their next request later, so the load drops by itself. This closed loop never falls behind.

`--request-rate` sends requests at a fixed rate, whether the server keeps up or not. Past the rate the server can serve, the queue grows, and the first token takes longer with every request. Real traffic behaves more like a fixed rate. Run both before you set a capacity limit.

## Know how our numbers were made

Our sweeps used the benchmark client of SGLang, `sglang.benchmark.serving`, with `--backend vllm`. We used one client for both engines, so the comparisons on [the engine page](#s-decide-between-vllm-and-sglang) use one method. The client reports the same four numbers as `vllm bench serve`, but the two clients differ in small details. Do not compare our numbers directly with numbers from `vllm bench serve`.

```takeaways
- Sweep concurrency and read throughput, TTFT, TPOT, and ITL together.
- Use a new seed for each run, use --ignore-eos, and warm up first.
- Reset the prefix cache and record the cached tokens for each run you compare.
- Record the GPU clock, and compare runs only at similar clocks.
- Run a fixed request rate as well as a closed loop before you set a capacity limit.
```

Sources: vLLM documentation at v0.31.0 (docs/benchmarking/cli.md, docs/benchmarking/sweeps.md), the vLLM source at v0.31.0 (vllm/benchmarks/serve.py), capture/gpu/summary/l4.json (load.vllm), a 2026 study of prefix-cache effects on greedy outputs on vLLM 0.11.

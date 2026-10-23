# Troubleshoot by symptom

> Most failures have a known cause that one log line or one metric shows.

Something is wrong and you know what you see, not why. When you finish this section, you can match the symptom to a cause, run one check, and apply one fix.

Find your symptom in the list. Each entry gives the likely cause, the check that confirms it, and the fix. Issue numbers refer to the vLLM repository, with their state at version 0.31.0.

```figure
id: fig-7-1
kind: decision
title: symptom to page
claim: Start from the symptom, check one number or log line, and then go to the page that fixes it.
caption: Each row is one symptom. The sections below give the detail for each. From our runs and the vLLM issues.
```

## The server does not start

### The start stops with a message about the KV cache and the maximum length

- **Cause:** one request at `--max-model-len` needs more KV cache than is left after the weights.
- **Check:** the error gives the largest length that fits.
- **Fix:** set `--max-model-len` to your longest request. [The startup page](#s-fix-out-of-memory-at-startup) has the details.

### The start stops with a message about free memory and the memory fraction

- **Cause:** another process holds GPU memory, so the share you asked for is not free.
- **Check:** run `nvidia-smi` and look at the processes on the GPU.
- **Fix:** lower `--gpu-memory-utilization` below the free share, or stop the other process.

### The server crashes at start after you set an FP8 KV cache

- **Cause:** on some GPUs, FlashAttention cannot read an FP8 KV cache, so vLLM picks FlashInfer. If FlashInfer cannot compile its kernels on your machine, the start crashes. It does not try the Triton backend. Issue 60262 tracks this, and it is open.
- **Check:** find the line that names the attention backend, and the FlashInfer error after it.
- **Fix:** add `--attention-backend TRITON_ATTN`.

### A DGX Spark runs out of memory although the fraction leaves room

- **Cause:** on unified memory, `--gpu-memory-utilization` does not always limit what vLLM takes. A field report saw about 101 GiB taken at a fraction of 0.50. Issue 44740 reports a KV cache that was too large with MTP speculation on the GB10, and it is open.
- **Check:** compare the `Available KV cache memory` line with the share you expect, and watch `free -g` during the start.
- **Fix:** set the cache size in bytes with `--kv-cache-memory-bytes`. [The DGX Spark page](#s-size-memory-on-a-dgx-spark) has the details.

### The first start on a DGX Spark takes many minutes

- **Cause:** the weight load copies each tensor from the file map, and that copy is slow on the GB10. Issue 58726 tracks this, and it is open.
- **Check:** read the `Model loading took` line. Our 57 GiB load took 330 seconds.
- **Fix:** keep the weights on a local drive and keep the server running. [The DGX Spark page](#s-size-memory-on-a-dgx-spark) has the details.

### The maximum length is shorter after an upgrade

- **Cause:** release 0.30.0 changed how vLLM reads context scaling such as YaRN, and some models now get a shorter derived length.
- **Check:** compare the derived length in the startup log with the old one.
- **Fix:** set `--max-model-len` yourself, after you confirm that the model supports the length.

## The server is slow

### The first token takes seconds, but the stream is fast after it

- **Cause:** requests wait in the queue because the pool or the batch is full.
- **Check:** `vllm:num_requests_waiting` is above 0 and `vllm:kv_cache_usage_perc` is near 1.
- **Fix:** serve fewer users on the GPU, or make room in the pool with an FP8 KV cache or a shorter maximum length.

### The stream stutters when many users are active

- **Cause:** new prompts share decode steps with running requests, and long prompts take a large part of each step.
- **Check:** compare the P99 ITL with the median ITL. A large gap means stalls, not a slow GPU.
- **Fix:** measure your traffic shape. On our machines the stutter depended on the prompt lengths and on the card. [The engine page](#s-decide-between-vllm-and-sglang) has the numbers.

### The preemption counter rises

- **Cause:** a running request needed a new block and none was free. vLLM stops the request and computes it again later.
- **Check:** `vllm:num_preemptions_total` rises, and the periodic log line shows a preemption count.
- **Fix:** raise `--gpu-memory-utilization`, or lower `--max-num-seqs` or `--max-num-batched-tokens`.

### N-gram speculation gives less than you expected

- **Cause:** at 0.31.0, the n-gram method makes vLLM use the older model runner, and it turns off async scheduling.
- **Check:** the startup log has a warning that async scheduling is off.
- **Fix:** compare it with no speculation on your traffic, with the same model runner on both sides.

### The first requests after a start in eager mode are slow

- **Cause:** since 0.31.0, `--enforce-eager` also turns off the warmup that compiles kernels at startup, so the first requests compile them.
- **Check:** the first few requests are slower than the rest.
- **Fix:** send a few warmup requests before you serve traffic, or use `-O0` instead.

### NVFP4 decode is slower on a DGX Spark than on older releases

- **Cause:** issue 59770 reports a slower decode for one NVFP4 model on the GB10 since 0.29.0. It is open.
- **Check:** compare the time per token on your version and on 0.28.
- **Fix:** pin the faster release for that model until the issue closes.

## The output is wrong

### The model repeats one token after a prefix-cache hit

- **Cause:** issue 60174 reports corrupt output on 0.30 and 0.31 when DFlash2 or DSpark speculation runs with the prefix cache. From the third request, each answer that starts from cached blocks is one token, over and over. It was closed on 2026-10-22, after 0.31.0, so check that your version has the fix.
- **Check:** the problem starts only after a cache hit, and it goes away with `--no-enable-prefix-caching`.
- **Fix:** turn off the prefix cache or the speculation method for that model.

### JSON output is invalid with speculative decoding on

- **Cause:** a JSON schema and a speculation method can disagree on the next tokens. Issue 60830 showed this for MTP on one model, and it is closed.
- **Check:** run the same requests without `--speculative-config`.
- **Fix:** upgrade, or turn off speculation for JSON traffic.

### The output changes from run to run

- **Cause:** vLLM does not promise the same output by default. The batch that a request joins changes the order of the sums. A prefix-cache hit can also change a greedy output.
- **Check:** send the same request alone twice. If the answers match, the batch causes the change. If they differ, the second request can hit the prefix cache. Repeat the test with `--no-enable-prefix-caching`. If the answers now match, the cache causes the change.
- **Fix:** offline, set `VLLM_ENABLE_V1_MULTIPROCESSING=0`. Online, the batch-invariant mode helps, but at 0.31.0 it does not cover every path. Reset the prefix cache between runs that you compare. [The reproducibility page](#s-get-reproducible-outputs) covers it.

## The benchmark is wrong

### The second benchmark run is faster than the first

- **Cause:** with a fixed seed, the random dataset sends the same prompts again, and the prefix cache serves them.
- **Check:** `vllm:prefix_cache_hits_total` rises during the second run.
- **Fix:** reset the prefix cache before each run, use a new seed, and record the cached tokens. [The benchmark page](#s-benchmark-your-server-in-15-minutes) gives the protocol. The `POST /reset_prefix_cache` route exists only with `VLLM_SERVER_DEV_MODE=1`, so use it only on a server that is not exposed.

```takeaways
- Read the last log lines and the waiting and cache metrics before you change a flag.
- Check the open issue for your model, GPU, and version before you blame your setup.
- Test one change at a time, with the same benchmark and clock.
```

Sources: vLLM issues 58726, 59770, 60174, 60262, and 60830; the release notes for v0.30.0, v0.31.0, and v0.32.0; vLLM documentation at v0.31.0 (docs/configuration/optimization.md, docs/usage/reproducibility.md, docs/benchmarking/cli.md); the vLLM source at v0.31.0 (vllm/config/vllm.py, vllm/config/model.py); capture/gpu/out-gb10/server-load-vllm.log, vLLM issue 44740, a user report of about 101 GiB taken at a fraction of 0.50 on a GB10, a 2026 study of prefix-cache effects on greedy outputs on vLLM 0.11.

# Keep long sessions cheap

> Old turns cost nothing while they stay in the cache, and offload keeps them when the GPU pool is full.

A long conversation slows down as it grows. When you finish this section, you can keep earlier turns cached without a full prefill.

## Why a long session slows down

Each turn of a chat sends the whole conversation again. Without a cache, the server computes every earlier turn on every request, so the first token takes longer with each turn.

The prefix cache removes that cost while the earlier turns stay in the cache. Turn 10 starts with the same tokens as turn 9, so the blocks of turn 9 are a hit. Only the new user message and the answer need compute.

The cache keeps a block only until a running request needs the memory. On a busy server, the blocks of a user who paused for a minute can be gone when that user sends the next turn. The whole conversation is then computed again.

## Keep the prompt stable across turns

The hit needs the same tokens in the same order:

- Send earlier turns exactly as before. Do not trim, summarize, or reformat them between turns.
- Keep the system prompt and the tool list the same for the whole session.
- If you must shorten a conversation, cut whole turns from the middle, not from the start. A change at the start makes every later block miss.

## Offload blocks to host memory

When the GPU pool is too small to keep idle sessions, vLLM can copy blocks to CPU memory before it drops them. A later request reloads them from CPU memory, which is faster than a full prefill of a long context.

The native offload needs one flag, the CPU memory to use in GiB:

```bash
vllm serve Qwen/Qwen3-8B --kv-offloading-size 32
```

`--kv-offloading-backend` picks the implementation. `native` uses the code in vLLM, and `lmcache` uses the LMCache library. The offload trades CPU memory and PCIe transfer time for compute.

Not measured on our hardware. We have not timed a reload from CPU memory against a prefill on the L4 or the GB10.

## Use a shared cache across servers

With several servers behind a router, a user's next turn can go to a server that never saw the earlier turns. Two fixes exist. A router that sends a session to the same server keeps the hit on that server. A shared KV store, through a KV connector such as LMCache or Mooncake, lets any server load the blocks. [The KV connector page](#s-how-kv-connectors-move-the-cache) explains the second.

```takeaways
- The prefix cache makes earlier turns free while their blocks stay in the pool.
- Send earlier turns unchanged, and never change the start of the conversation.
- Offload blocks to CPU memory when idle sessions do not fit the GPU pool.
```

Sources: the vLLM source at v0.31.0 (vllm/config/cache.py, vllm/v1/kv_offload/), vLLM documentation at v0.31.0 (docs/features/kv_offloading_usage.md, docs/design/prefix_caching.md).

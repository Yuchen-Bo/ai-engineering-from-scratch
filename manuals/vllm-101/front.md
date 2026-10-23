# How to read this manual

> This manual helps you serve, size, tune, and debug open models with vLLM, and it gives a measured answer for each decision.

The vLLM documentation tells you what each flag does. This manual tells you which flags matter for your GPU and your traffic, and what happened when we changed them.

## Start here

These commands give you a server:

```bash
uv venv --python 3.12 --seed
source .venv/bin/activate
uv pip install vllm==0.31.0 --torch-backend=auto
vllm serve Qwen/Qwen3-0.6B
curl http://localhost:8000/v1/models
```

[Part 1](#s-install-vllm-and-serve-your-first-model) walks through each command and the output you should see.

## What you can do after this manual

- Install vLLM, serve a model, and read the startup lines that decide most answers.
- Predict how many users fit on your GPU, and fix an out-of-memory failure at startup.
- Pick the one or two flags that matter for your traffic, and leave the rest at the default.
- Decide from a measurement when speculative decoding, FP8, or a compile level pays.
- Debug a slow or broken server from the symptom you see.

## Who this manual is for

You have called a model through an API, and now you want to serve an open model yourself. You know what a token and a GPU are. You have not read the code of a serving engine, and you do not need to.

## How the parts are ordered

Parts 1 to 7 follow the order of your work. You start a server, size it, tune it for your traffic, add speed features, measure it, scale it, and run it. Each page answers one question and ends with a check that proves the change worked.

Part 8 explains how vLLM works inside. Read it when a default surprises you. The reference pages hold the flag table, the metrics, the incident index, and the lab notes.

```parts
```

## What we tested on

We tested on vLLM 0.31.0 with an NVIDIA L4 and a DGX Spark. The L4 served Qwen3-8B, and the DGX Spark served Qwen3-30B-A3B. Each measured number in this manual names its machine. [The lab notes](#s-ref-lab-notes) give the seeds, the clocks, and the full tables.

## Draft edition

This edition is a draft. Every page is written. Each measured page gives its date, clock, and seed count, and other pages say what we did not measure.

Sources: vLLM documentation at v0.31.0 (docs/getting_started/quickstart.md), capture/gpu/summary/l4.json, capture/gpu/summary/gb10.json.

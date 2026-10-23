# Run GRPO on one GPU with the radixark/miles image

> One container, one small model, and one launcher script give you a logged GRPO step on a single GPU in about ten minutes.

We start from an empty folder and end with one finished GRPO step, logged to a file. The model is Qwen3-0.6B and the data is GSM8K, so the run fits on one GPU and each step takes a few minutes.

When you finish this section, you can start a GRPO run on one GPU. You can also find the log lines that prove the first step finished.

**Our result:** on one GB10 with Qwen3-0.6B, the first GRPO step took 233 s and the median step 167 s.

```figure
id: fig-1-1
kind: flow
title: One GRPO step on one GPU
claim: Each step runs rollout, scoring, log probabilities, training, and a weight update, in that order, on one GPU.
caption: Medians of 48 steps of a run made before we added the heat guard, so no pause could occur. Qwen3-0.6B on one GB10. The numbers follow the order of the arrows.
```

## Check what you need

You need one NVIDIA GPU, Docker, and the NVIDIA container toolkit. Run this check first:

```bash
docker run --rm --gpus all radixark/miles:latest nvidia-smi --query-gpu=name,memory.total --format=csv
```

You should see your GPU name. If Docker says it cannot select a device driver, install the NVIDIA container toolkit and restart Docker.

```listing
title: the GPU check on our machine
source: capture/gpu/out-gb10/gpu-check.txt
lang: text
note: The GB10 shares one memory pool between the CPU and the GPU, so it reports no separate GPU memory.
---
name, memory.total [MiB]
NVIDIA GB10, [N/A]
```

Our GPU was a DGX Spark GB10 with 128 GB of shared memory. We did not test a smaller card. [Section 2.1](#s-pick-a-model-size) covers model size and memory.

## Pull the image and record what you pulled

The `latest` tag moves. Record the image digest and the Miles commit before the run, so you can compare runs later.

```bash
docker pull radixark/miles:latest
docker image inspect --format "{{index .RepoDigests 0}} {{.Architecture}}" radixark/miles:latest
docker run --rm --entrypoint git radixark/miles:latest -C /root/miles log -1 --format="%h %cs %s"
```

```listing
title: the image we ran
source: capture/gpu/out-gb10/image-identity.txt
lang: text
note: The digest, the CPU architecture, the Miles commit, and the SGLang version inside the image.
---
radixark/miles@sha256:c64fa344e3a86715f03c0a1b6a422c474e0035355591a2f6da87bf52a74c52da arm64
08752a1283 2026-10-15 fix(ci): keep host networks out of the builder disk cleanup (#4130)
0.5.22.dev46+g7b6993a
```

The image is built for `arm64` and `amd64`. It holds its own build of SGLang, which is the rollout engine. Use that build and do not install another SGLang into the image.

## Make a lab folder

The container reads the launcher script, the model, and the data from one folder that you mount at `/root/lab`. Create it and copy the launcher script from this manual into it:

```bash
mkdir -p ~/miles-lab/runs
cp manuals/miles-101/capture/gpu/miles_grpo.py ~/miles-lab/
```

The launcher downloads `Qwen/Qwen3-0.6B` and the `zhuzilin/gsm8k` dataset into the folder on its first run. Then it builds the Miles command and starts it.

## Read the settings the launcher uses

The launcher passes 36 flags to Miles. Most of them keep their defaults. These are the ones that shape the run:

| Flag | Value | What it decides |
|---|---|---|
| `--colocate` | on | the trainer and the rollout engine share the one GPU and take turns |
| `--train-backend` | `fsdp` | the trainer uses PyTorch FSDP, which needs no Megatron setup |
| `--rollout-batch-size` | 32 | prompts per step |
| `--n-samples-per-prompt` | 8 | answers per prompt, which form one group |
| `--global-batch-size` | 256 | samples per optimizer step, which is 32 times 8 |
| `--rollout-max-response-len` | 1024 | the longest answer, in tokens |
| `--rm-type` | `math` | the reward is 1 for a correct final answer and 0 otherwise |
| `--sglang-mem-fraction-static` | 0.4 | the share of GPU memory the rollout engine keeps for weights and the KV cache |

**Group:** the answers that one prompt gets in one step. GRPO scores each answer against the mean reward of its group.

The rollout batch size counts prompts, and the global batch size counts samples. With 32 prompts and 8 answers each, one rollout gives 256 samples, so each step makes one optimizer update.

## Start the run

Run the container with the GPU, the lab folder, and your model cache mounted:

```bash
cd ~/miles-lab
docker run --rm --name miles-plain --gpus all --ipc=host --shm-size 32g --ulimit memlock=-1 \
  -v "$HOME/miles-lab:/root/lab" -v "$HOME/.cache/huggingface:/root/.cache/huggingface" \
  -e MILES_NUM_ROLLOUT=12 -e MILES_RUN=plain \
  radixark/miles:latest python /root/lab/miles_grpo.py > runs/plain.log 2>&1
```

`MILES_NUM_ROLLOUT` sets the number of steps. Our 12-step run took 35 minutes on the GB10, from the first log line to the last. Start the watchdog from [section 1.2](#s-add-a-watchdog) in a second terminal before you leave the run alone.

## Read the startup lines

Open the log in another terminal with `tail -f runs/plain.log`. The run starts Ray, then the rollout engine, then the trainer. These lines tell you each part came up:

```listing
title: the startup of a colocated run
source: capture/gpu/out-gb10/plain-first-step.log
lang: text
note: Three lines from our 12-step run. The middle of each long line is cut.
---
[2026-10-17 15:53:16.726 launcher] common.py:290 - EXEC: export PYTHONUNBUFFERED=1 && ray start --head --node-ip-address 127.0.0.1 --num-gpus 1 …
(CommandActor pid=2546) [2026-10-17 15:54:38] Load weight end. elapsed=5.85 s, type=Qwen3ForCausalLM, avail mem=94.82 GB, mem usage=1.40 GB.
(CommandActor pid=2546) [2026-10-17 15:54:40] KV Cache is allocated. dtype: torch.bfloat16, #tokens: 345645, K size: 18.46 GB, V size: 18.46 GB
```

The engine loaded 1.40 GB of weights and kept room for 345,645 tokens of KV cache. One step needs at most 256 answers of 1,024 tokens each, plus their prompts.

If no `KV Cache is allocated` line appears within five minutes, the rollout engine did not start. Read the lines above it for an `Error` or an `AssertionError`, and see [section 7.1](#s-troubleshoot-by-symptom).

## Find the first finished step

A step ends when the trainer logs a `step 0` line and a `perf 0` line. Search for them:

```bash
grep -c " - step [0-9]*: {" runs/plain.log
```

The count is the number of finished steps. Our first step logged these lines:

```listing
title: the first step, from rollout to timers
source: capture/gpu/out-gb10/plain-first-step.log
lang: text
note: Each line is cut to the fields that this section uses.
---
(FSDPTrainRayActor pid=2551) [2026-10-17 15:56:48.271 actor_cell00000_rank00000] log_utils.py:125 - rollout 0: {'rollout/response_lengths': 739.92578125, … 'rollout/raw_reward': 0.62890625, …
(FSDPTrainRayActor pid=2551) [2026-10-17 15:58:15.687 actor_cell00000_rank00000] log_utils.py:554 - step 0: { … 'train/train_rollout_logprob_abs_diff': 0.015336457639932632, …
(FSDPTrainRayActor pid=2551) [2026-10-17 15:58:15.688 actor_cell00000_rank00000] perf.py:56 - perf 0: {'perf/sleep_time': 2.1116080284118652, … 'perf/update_weights_time': 0.6647534370422363, … 'perf/step_time': 233.29494333267212, …
```

The first step took 233 s. The median step took 167 s. In a typical step, the rollout took 57 s and the training phase took 105 s, and 25 s of that computed log probabilities. The weight update from the trainer to the engine took 0.65 s.

[Section 1.3](#s-read-your-first-ten-steps) explains how to read these numbers over the first ten steps.
```figure
id: fig-1-1b
kind: chart
title: Where the time of one step goes
claim: Training and rollout take almost all of a step, and the hand-offs take about 2 s.
caption: Median seconds per phase over 48 steps of a run made before we added the heat guard. The log-probability pass and the gradient step together make the training phase.
```


```takeaways
- Record the image digest and the Miles commit before every run.
- Set the rollout batch in prompts and the global batch in samples.
- Wait for the KV cache line before you trust that the engine started.
- Count finished steps with the step lines in the log.
```

Sources: capture/gpu/miles_grpo.py; capture/gpu/out-gb10/gpu-check.txt; capture/gpu/out-gb10/image-identity.txt; capture/gpu/out-gb10/plain-first-step.log; capture/gpu/summary/miles-gb10-lab.json (runs.plain); Miles arguments at main 08752a12.

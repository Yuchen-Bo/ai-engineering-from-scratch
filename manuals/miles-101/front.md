# How to read this manual

> This manual gets a GRPO run going on one GPU first, then shows how to size it, check it, and fix it.

## What you run in the first 30 minutes

Four commands start a run of reinforcement learning on one GPU. Run them from a clone of this repository. A small model learns grade-school math, and the log shows its reward go up. Section 1.1 explains each command. The third command keeps its terminal busy until the run ends. While it runs, start the watchdog from [section 1.2](#s-add-a-watchdog) in a second terminal, because a run whose engine dies does not stop by itself.

```bash
docker pull radixark/miles:latest
mkdir -p ~/miles-lab && cp manuals/miles-101/capture/gpu/miles_grpo.py ~/miles-lab/
docker run --rm --name miles-plain --gpus all --ipc=host --shm-size 32g -v "$HOME/miles-lab:/root/lab" -e MILES_NUM_ROLLOUT=12 radixark/miles:latest python /root/lab/miles_grpo.py > plain.log 2>&1
grep -o "'rollout/raw_reward': [0-9.]*" plain.log
```

## What you can do after this manual

You can serve a model and you know what a reward is. You want to train a model with reinforcement learning, and you want to know which settings matter before you rent a cluster.

After the manual, you can:

- Run GRPO on one GPU and read the first ten steps.
- Stop a run that keeps going after its rollout engine died.
- Pick a model size that fits training and rollout on one GPU.
- Check that a run is correct, and not only that it runs.
- Find the cause of a failed run from its first symptom.

## What we found

Every result in this manual comes from runs on one machine, so each page says how far the result goes. Five results change what you do:

- A run whose engine dies keeps going and never fails. On our machine it logged 200,533 errors in 63 minutes. Start every run with a watchdog ([section 1.2](#s-add-a-watchdog)).
- On one 128 GB machine, a 1.7B model fits for short steps of 256 tokens, and a 4B model does not ([section 2.1](#s-pick-a-model-size)).
- The weight update between the trainer and the engine takes under one percent of a step. Tune training and rollout first ([section 2.4](#s-size-the-weight-update)).
- Deterministic inference makes the engine repeat itself. It does not lower the gap between the trainer and the engine ([section 4.5](#s-use-deterministic-inference)).
- A machine that pauses for heat adds time that is not work. Compare runs on the same clean steps ([section 5.3](#s-repeat-a-run)).

## How we tested it

We ran every command on one NVIDIA DGX Spark, with a GB10 chip and 128 GB of memory that the CPU and the GPU share. The model was Qwen3-0.6B, and the data was GSM8K. The lab notes in the reference part give the image, the versions, the seeds, and the full tables.

Miles is built for large mixture-of-experts runs on many GPUs. One GPU cannot show all of it. Each page says what we measured and what we could only read in the source.

The overview of one Miles step is in the [Inside Miles guide](https://rohitghumare.com/guides/inside-miles), and the colocated loop is in [SGLang 101, section 7.2](https://aiengineeringfromscratch.com/manual-sglang-101.html#s-sglang-as-an-rl-rollout-engine). This manual does not repeat them.

## How the parts are ordered

```parts
```

Sources: manual.json; capture/gpu/out-gb10/image-identity.txt; capture/gpu/out-gb10/engine-died-count.txt; capture/gpu/out-gb10/ray-oom-4b-lowmem.log; capture/gpu/miles_grpo.py; capture/gpu/summary/miles-gb10-lab.json.

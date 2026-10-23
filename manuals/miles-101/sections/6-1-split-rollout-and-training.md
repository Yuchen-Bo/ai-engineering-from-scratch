# Split rollout and training across GPUs

> On many GPUs, rollout and training can run on separate devices, and a transfer method moves the weights between them.

On one GPU, the trainer and the engine take turns, and the weight update is a copy inside the GPU. On many GPUs you have a choice. Keep both sides on the same GPUs and take turns, or give each side its own GPUs and send the weights across.

When you finish this section, you can choose a placement and a weight transfer method for a run on many GPUs.

We cannot measure this on our single GB10. This page comes from the Miles source and documentation.

## Choose a placement

| Placement | Flag | GPUs used | Each side waits for the other |
|---|---|---|---|
| Colocated | `--colocate` | the larger of the trainer GPUs and the rollout GPUs | yes, every step |
| Split | no `--colocate` | the trainer GPUs plus the rollout GPUs | yes, unless you run async training |

Set the sizes with these flags:

- `--actor-num-nodes` and `--actor-num-gpus-per-node` set the trainer GPUs.
- `--rollout-num-gpus` sets the rollout GPUs in a split layout.
- `--rollout-num-gpus-per-engine` sets how many GPUs each rollout engine uses.

Start colocated. Split only when the rollout phase takes most of the step and you have the GPUs to give it. A split layout leaves trainer GPUs idle during rollout unless you also run async training, as in [section 4.1](#s-run-rollout-and-training-at-once).

## Choose how the weights move

In a split layout, the weights leave the trainer GPUs after every update. `--update-weight-transfer-mode` picks the method:

| Method | What it does | Needs |
|---|---|---|
| `broadcast`, the default | sends each tensor over NCCL, one by one | nothing extra |
| `broadcast_packed` | packs each bucket into one send | the Megatron trainer and a split layout |
| `p2p` | moves the weights over RDMA with Mooncake | Mooncake and an RDMA network |
| `disk-delta` | writes only the changed bytes to a shared folder, and each engine loads them | `--update-weight-disk-dir` |

Under `--colocate`, Miles uses a copy inside the GPU instead, and the transfer mode does not apply.

## What to measure after the split

- `perf/update_weights_time` against `perf/step_time`. On many machines the transfer is no longer a copy inside one GPU.
- The idle time on each side, from `perf/train_wait_time` and the rollout timers.
- The gap between the trainer and the engine, as in [section 5.2](#s-check-the-first-step), after the first update with the new method.

```takeaways
- Start colocated, and split only when rollout takes most of the step.
- Keep broadcast until the weight transfer is a large share of the step.
- Measure the update time and the idle time on both sides after a split.
```

Sources: Miles main 08752a12 files miles/ray/placement_group.py, miles/utils/arguments.py, miles/backends/training_utils/weight_update/protocol.py, miles/backends/training_utils/weight_update/protocols/broadcast.py, miles/backends/training_utils/weight_update/protocols/delta.py, miles/backends/training_utils/metrics/perf.py, docs/advanced/disaggregated-rollout.md, docs/advanced/p2p-weight-transfer.md.

# Run evaluation without stopping training

> Evaluation on the training engines pauses rollout, and a separate fleet avoids the pause at the cost of its own GPUs.

You want an eval score every few steps, such as accuracy on a held-out math set. That eval needs generation, and generation needs engines. The question is which engines.

When you finish this section, you can choose where evaluation runs, and set it up.

We cannot measure the dedicated fleet on our single GB10, because it needs GPUs of its own. This page comes from the Miles source and documentation.

## Three places to run evaluation

| Where | How to select it | Cost |
|---|---|---|
| The training engines | the default | rollout production stops while the eval runs |
| A dedicated fleet | `--eval-num-gpus N` | N GPUs of the job go to eval, and training never stops for it |
| Your own service | `--eval-function-path` set to a checkpoint eval function | only the checkpoint export |

You cannot select the fleet together with a checkpoint eval function for your own service. Rollout fault tolerance from [section 6.3](#s-survive-failures) also does not work with a fleet.

## Evaluate on the training engines

Set the interval and the data:

```bash
--eval-interval 10 --eval-prompt-data gsm8k_test /data/gsm8k/test.parquet
```

Rollout stops while the eval runs, and requests that are already running finish first. The engines already hold the current weights, so no extra weight transfer happens. Use this mode on one GPU, and for small eval sets.

## Evaluate on a dedicated fleet

```bash
--eval-num-gpus 1 --eval-interval 10 --eval-hf-dir /dev/shm/miles_eval_hf --eval-prompt-data aime /data/aime.jsonl
```

The fleet runs its own engines behind its own router. On each eval step, the trainer writes a checkpoint snapshot to `--eval-hf-dir`, hands it to the fleet, and keeps training. The fleet loads the snapshot. It does not take part in the training weight updates.

The eval point still appears at the step it belongs to, even when it finishes a few steps later. `eval/lag_steps` reports how many steps late it finished.

The fleet engines copy every `--sglang-*` setting of the rollout engines. Change one with the matching `--eval-sglang-*` flag, for example `--eval-sglang-mem-fraction-static 0.9`, because the fleet does not share its GPUs with training.

## Choose by the cost of the pause

Start with the training engines. Move to a fleet when the eval pause becomes a large share of the step time, and when you can spare whole GPUs. A staging folder in `/dev/shm` keeps the snapshot off the disk.

```takeaways
- Run eval on the training engines until the pause costs too much of the step.
- Use a dedicated fleet when you can spare GPUs, and watch eval/lag_steps.
- Change fleet engine settings with the --eval-sglang-* flags.
```

Sources: Miles main 08752a12 files docs/user-guide/fully-async.md, miles/utils/arguments.py, miles/backends/sglang_utils/arguments.py, miles/backends/sglang_utils/sglang_config.py, miles/ray/rollout/eval_fleet.py, miles/ray/rollout/eval_dispatch.py, miles/ray/rollout/rollout_executor.py, miles/rollout/checkpoint_eval.py.

# Keep a long run going after a failure

> Long runs on many machines lose engines and nodes, and Miles has fault tolerance and checkpoints for that.

A run on one GPU fails in simple ways, and you restart it. A run on hundreds of GPUs for days will lose an engine or a node along the way. The question is how much of the run you lose with it.

When you finish this section, you can set up checkpoints and fault tolerance for a long run, and test them before you rely on them.

We cannot test fault tolerance on our single GB10. On one GPU, a dead engine means a dead run, as [section 1.2](#s-add-a-watchdog) shows. This page comes from the Miles source and release notes.

## Save checkpoints first

Checkpoints limit the work you lose when you restart after a failure. They do not help when the storage fails, when a checkpoint is damaged, or for the steps after the last checkpoint. Set them before anything else:

```bash
--save /ckpt/run-a --save-interval 20 --load /ckpt/run-a
```

`--save-interval` counts steps. Choose it from the step time, so that a crash loses less work than you can accept. With a step of five minutes, an interval of 12 loses at most one hour.

Test a restart from a checkpoint on a short run, before the long run starts.

## Turn on fault tolerance

```bash
--use-fault-tolerance --ft-components rollout
```

`--ft-components` picks what Miles watches and replaces: `rollout`, `train`, or both. Without the flag, Miles watches `rollout`. Each part has limits in the Miles version we ran:

- Rollout fault tolerance does not work with a dedicated eval fleet, or with `--fully-async --colocate`.
- Train fault tolerance turns on independent data-parallel groups, and those need the Megatron trainer.

Miles main of 2026-10-20 changes this. It adds `weight_update` as a third part. It also allows rollout fault tolerance only with `p2p` weight transfer on a split layout. Read the flag help in your image before you copy a command.

## What the Miles team reports

The Miles team built a fault injector for its tests. Their release notes report a run where a rollout engine crashed. Its loss curve matched a run without a crash, bit for bit. That is their test on their hardware. Repeat a crash test on your own setup before you trust it.

## Known problems

- A report in the Miles issue tracker covers six agent example launchers. Each starts with a cleanup that stops every process with `sglang` in its command line. With `MILES_SCRIPT_EXTERNAL_RAY=1`, that cleanup also stops the Ray cluster that you started. With those launchers, remove the cleanup or give Miles its own Ray cluster.
- After an engine dies without fault tolerance, the trainer keeps sending requests to it and never fails. Add a watchdog to every run.

```takeaways
- Set checkpoints before fault tolerance, and test a restart on a short run.
- Read the fault tolerance limits in the flag help of your image before a long run.
- Test an engine crash on your own setup before a long run.
```

Sources: Miles main 08752a12 files miles/utils/arguments.py, docs/advanced/fault-tolerance.md, miles/ray/placement_group.py, miles/backends/training_utils/checkpoint/io.py, miles/utils/test_utils/fault_injector.py, compared with miles/utils/arguments.py at main ee36bb2a of 2026-10-20; Miles release notes v0.1.2; Miles issue 3649; capture/gpu/out-gb10/engine-died-503.log.

# Read the run from its signals

> Eight signals in the log tell you in a few minutes if a run is healthy.

The reward is the signal everyone reads first, and it is the slowest to tell you that something is wrong. Seven other signals show a broken run earlier.

When you finish this section, you can decide if a run is healthy from its logged signals. You can also tell which changes need action.

## The eight signals

These are the ranges over all 48 steps of our three baseline seeds. The runs trained Qwen3-0.6B on GSM8K, with 32 prompts of 8 answers each and a limit of 1,024 tokens.

| Signal | Log name | Range in our runs | A healthy run |
|---|---|---|---|
| reward | `rollout/raw_reward` | 0.53 to 0.87 per step | rises over the run, with swings from step to step |
| answer length | `rollout/episode_response_length/mean` | 396 to 787 tokens | falls as the model learns shorter answers |
| cut share | `rollout/truncated` | 0.02 to 0.43 | falls with the length |
| gap | `train/train_rollout_logprob_abs_diff` | 0.0136 to 0.0164 | stays flat |
| KL to the engine | `train/train_rollout_kl` | 0.00063 to 0.00076 | stays flat |
| gradient norm | `train/grad_norm` | 0.35 to 4.95 | stays in one range, with rare spikes |
| clip fraction | `train/pg_clipfrac` | 0 | stays at 0 with one update per rollout |
| rollout time | `perf/rollout_time` | varies with length and heat | falls with the length |

**Clip fraction:** the share of tokens where the update hit the clip limit. Our runs did one optimizer update per rollout. So the policy of the trainer stayed the one that scored the samples, and nothing was clipped.

Our runs logged `train/entropy_loss` as 0 at every step, so this setup does not show the entropy of the model.

## Read trends, not steps

From one step to the next, the reward moved by up to 0.21 in our runs. A single step tells you little. Read the mean over five or more steps.

All three seeds showed the same trend. The reward rose from about 0.63 in the first 8 steps to about 0.75 in the last 8. In the same steps, the mean length fell from about 720 to about 460 tokens.

## Act on these changes

| Change | Likely cause | First check |
|---|---|---|
| The gap jumps and stays high | the engine and the trainer no longer use the same weights | the weight update logs, and [section 5.2](#s-check-the-first-step) |
| The gradient norm grows step after step | the learning rate is too high for this batch | lower the learning rate and repeat |
| The reward falls and the length rises | the model has learned to talk longer instead of better | the reward function, and the cut share |
| The clip fraction is above 0 with one update per rollout | the samples did not come from the current weights | the update interval and the async settings |
| The rollout time grows with flat length | the engine or the GPU is slower | the heat log and the engine log |

Keep your own ranges. These numbers hold for our model, data, and machine. Run two or three seeds of your own setup, and use their ranges instead.

```takeaways
- Read the gap, the KL, and the gradient norm before you read the reward.
- Read the mean over five or more steps, not a single step.
- Build the healthy ranges from your own seeds.
```

Sources: capture/gpu/summary/miles-gb10-lab.json (runs.plain-48, runs.plain-48-s2, runs.plain-48-s3); Miles loss and metric code at main 08752a12.

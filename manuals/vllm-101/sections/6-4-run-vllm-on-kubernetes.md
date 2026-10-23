# Run vLLM on Kubernetes

> A layer above vLLM adds routing and scaling, and you pick it by the features you need.

You must run many vLLM servers on a cluster. When you finish this section, you can pick the layer that runs vLLM on Kubernetes.

## Start with what one Deployment gives you

The vLLM documentation shows a plain Kubernetes setup. It has a volume for the weights, a secret for the Hugging Face token, a Deployment that runs `vllm serve`, and a Service. A small Helm chart in the vLLM repository packages the same pieces. It adds a job that downloads the model and an optional Kubernetes autoscaler.

This is enough for a few replicas of one model. A plain Service spreads requests at random, so a user's next turn can go to a replica that never cached the earlier turns. An autoscaler on CPU use also scales on the wrong signal, because GPU load is not CPU load.

## Pick a layer for the features you need

| Layer | What it adds | Pick it when |
|---|---|---|
| vLLM production stack | a Helm chart, a router that keeps sessions on one replica, KV sharing through LMCache, and Grafana dashboards | you want the reference setup from the vLLM project |
| llm-d | a router that reads vLLM metrics and KV cache events to pick a replica, prefill and decode split, wide expert parallelism | you run large models or split prefill and decode on a cluster |
| KServe | a model-serving platform with a vLLM runtime, and an LLM resource built on llm-d | your company already runs KServe for other models |
| AIBrix | a control plane with routing, LoRA management, and autoscaling on engine metrics | you need many models and adapters with one control plane |
| Ray Serve LLM | vLLM inside Ray Serve, with multi-model serving | your stack already runs on Ray |

llm-d published its version 1.0 on 2026-10-20. It joined the CNCF as a sandbox project in March 2026. Its router follows the Gateway API Inference Extension, a Kubernetes project for routing to model servers.

## Know which vLLM features the layers use

The layers read the same vLLM interfaces. Check that your vLLM version supports the ones your layer needs:

- **Metrics.** The routers read `vllm:num_requests_waiting`, `vllm:num_requests_running`, and `vllm:kv_cache_usage_perc` to pick a replica.
- **KV cache events.** With `--kv-events-config`, vLLM publishes each block it stores and removes. A router uses these events to send a request to the replica that holds its prefix.
- **KV connectors.** The prefill and decode split and the shared cache use `--kv-transfer-config`.
- **Health.** `/health` serves the liveness and readiness probes.

Not measured on our hardware. We have no cluster run.

```takeaways
- A plain Deployment works for a few replicas, but it routes at random and scales on the wrong signal.
- Pick the layer by the feature you need: session routing, the prefill and decode split, or many adapters.
- Check that your vLLM version supports the metrics, events, and connectors your layer reads.
```

Sources: vLLM documentation at v0.31.0 (docs/deployment/k8s.md, docs/deployment/frameworks/helm.md, docs/deployment/integrations/), the llm-d v1.0.0 release notes and architecture documents (2026-10-20), the CNCF announcement of llm-d (2026-03-24), the production-stack, AIBrix, and KServe documentation (accessed 2026-10-21).

# Pick an image for your GPU

> The image decides which kernels your GPU can run, so pick it from your GPU generation, and pin its digest.

Miles runs inside a container image that holds Miles, a patched SGLang, the trainer libraries, and prebuilt GPU kernels. The kernels are the part that ties an image to a GPU.

When you finish this section, you can choose a Miles image for your GPU and record exactly which one a run used.

## Start from the official image

The Miles team publishes `radixark/miles` with a tag per release and a `latest` tag. Each image is built for CUDA 13, for both `linux/amd64` and `linux/arm64`.

At release v0.1.2, the image builds on SGLang v0.5.21 with the Miles patches on top. So the SGLang inside the image is not a stock SGLang release. Read its version from the image, not from the SGLang project.

## Check the kernels against your GPU

The image holds FlashAttention 2 and FlashAttention 3. The FlashAttention 3 build targets Hopper only. On any other GPU, a setting that needs FlashAttention 3 fails at start, as [section 4.6](#s-know-the-true-on-policy-limits) shows.

The Miles documentation lists NVIDIA GPUs from A100 to GB300, and AMD MI300X to MI355X. Our GB10 is not on that list. The arm64 image still ran on our GB10, with the FSDP trainer and the default FlashInfer attention.

## Record what each run used

`latest` moves. Two runs a week apart can use different code under the same tag. Record three facts at the start of every run:

```listing
title: the identity of the image that our runs used
source: capture/gpu/out-gb10/image-identity.txt
lang: text
note: The digest names the exact image. The other two lines read the Miles commit and the SGLang version from inside it.
---
$ docker image inspect --format "{{index .RepoDigests 0}} {{.Architecture}}" radixark/miles:latest
radixark/miles@sha256:c64fa344e3a86715f03c0a1b6a422c474e0035355591a2f6da87bf52a74c52da arm64
$ docker run --rm --entrypoint git radixark/miles:latest -C /root/miles log -1 --format="%h %cs %s"
08752a1283 2026-10-15 fix(ci): keep host networks out of the builder disk cleanup (#4130)
$ docker run --rm --entrypoint /opt/sglang/bin/python3 radixark/miles:latest -c "import sglang;print(sglang.__version__)"
0.5.22.dev46+g7b6993a
```

Our `latest` image held Miles from 2026-10-15 and a development build of SGLang 0.5.22, newer than the v0.1.2 release.

To repeat a run, pull the image by its digest, not by its tag:

```bash
docker pull radixark/miles@sha256:c64fa344e3a86715f03c0a1b6a422c474e0035355591a2f6da87bf52a74c52da
```

```takeaways
- Pick the image from your GPU generation, and check which attention kernels it can run.
- Record the image digest, the Miles commit, and the SGLang version for every run.
- Pull by digest when you repeat a run.
```

Sources: capture/gpu/out-gb10/image-identity.txt; capture/gpu/out-gb10/engine-settings.txt; Miles Dockerfile, build script, and release notes v0.1.2; Miles README hardware list.

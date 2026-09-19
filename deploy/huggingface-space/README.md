---
title: Aegis Evaluator Model
emoji: 🛡️
colorFrom: indigo
colorTo: purple
sdk: gradio
sdk_version: 6.9.0
app_file: app.py
pinned: false
license: apache-2.0
suggested_hardware: zero-a10g
---

# Aegis evaluator model

An authenticated Gradio queue endpoint for low-volume Aegis pilot
evaluations. It serves `Qwen/Qwen2.5-0.5B-Instruct` on Hugging Face ZeroGPU.

Set the Space secret `AEGIS_SPACE_TOKEN`. Aegis calls the native ZeroGPU queue at:

```text
POST /gradio_api/call/chat
Authorization: Bearer <AEGIS_SPACE_TOKEN>
```

The free ZeroGPU quota is intended for development and bounded pilots. Keep the
deterministic adapter as the default and reserve this model for reviewed runs.

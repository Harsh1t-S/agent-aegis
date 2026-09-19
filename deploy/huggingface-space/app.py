from __future__ import annotations

import json
import os
import re
import secrets
import time
import uuid

import gradio as gr
import spaces
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer


MODEL_ID = os.getenv("MODEL_ID", "Qwen/Qwen2.5-0.5B-Instruct")
MAX_OUTPUT_TOKENS = int(os.getenv("MAX_OUTPUT_TOKENS", "512"))
TOOL_CALL = re.compile(r"<tool_call>\s*(\{.*?\})\s*</tool_call>", re.S)

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    torch_dtype=torch.bfloat16,
    attn_implementation="sdpa",
).eval().to("cuda")


def _authorise(request: gr.Request | None) -> None:
    expected = os.getenv("AEGIS_SPACE_TOKEN", "")
    supplied = ((request.headers.get("authorization", "") if request else "")
                .removeprefix("Bearer ").strip())
    if not expected or not secrets.compare_digest(supplied, expected):
        raise gr.Error("Invalid model endpoint credential")


def _message(text: str) -> dict:
    calls = []
    for index, match in enumerate(TOOL_CALL.finditer(text)):
        try:
            item = json.loads(match.group(1))
            if item.get("name"):
                calls.append({
                    "id": f"call_{index}_{uuid.uuid4().hex[:8]}",
                    "type": "function",
                    "function": {
                        "name": item["name"],
                        "arguments": json.dumps(item.get("arguments") or {}),
                    },
                })
        except (TypeError, json.JSONDecodeError):
            pass
    content = re.sub(
        r"<think>.*?</think>", "", TOOL_CALL.sub("", text), flags=re.S).strip()
    return {"role": "assistant", "content": content or None,
            **({"tool_calls": calls} if calls else {})}


@spaces.GPU(duration=60)
def chat(messages: list[dict], tools: list[dict], max_tokens: int,
         temperature: float, request: gr.Request | None = None) -> dict:
    _authorise(request)
    if not messages or len(messages) > 40:
        raise gr.Error("messages must contain between 1 and 40 turns")
    clean = []
    for message in messages:
        if message.get("role") not in {"system", "user", "assistant", "tool"}:
            raise gr.Error("Unsupported message role")
        clean.append({key: value for key, value in message.items()
                      if key in {"role", "content", "tool_calls", "tool_call_id"}})
    options = dict(add_generation_prompt=True, tokenize=True,
                   return_dict=True, return_tensors="pt")
    if tools:
        options["tools"] = tools[:32]
    inputs = tokenizer.apply_chat_template(clean, **options).to(model.device)
    prompt_tokens = int(inputs["input_ids"].shape[-1])
    if prompt_tokens > 8192:
        raise gr.Error("Input exceeds token limit")
    sample = temperature > 0
    with torch.inference_mode():
        output = model.generate(
            **inputs,
            max_new_tokens=min(max(int(max_tokens), 1), MAX_OUTPUT_TOKENS),
            do_sample=sample,
            temperature=max(float(temperature), 0.01) if sample else None,
            top_p=1.0,
        )
    generated = output[0][prompt_tokens:]
    text = tokenizer.decode(generated, skip_special_tokens=False).strip()
    completion_tokens = int(generated.shape[-1])
    message = _message(text)
    return {
        "id": f"chatcmpl-{uuid.uuid4().hex}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": MODEL_ID,
        "choices": [{
            "index": 0,
            "message": message,
            "finish_reason": "tool_calls" if message.get("tool_calls") else "stop",
        }],
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        },
    }


demo = gr.Interface(
    fn=chat,
    inputs=[
        gr.JSON(label="Messages", value=[{"role": "user", "content": "Say hello."}]),
        gr.JSON(label="Tools", value=[]),
        gr.Slider(1, 512, value=160, step=1, label="Maximum output tokens"),
        gr.Slider(0, 1, value=0, step=0.1, label="Temperature"),
    ],
    outputs=gr.JSON(label="OpenAI-compatible response"),
    title="Aegis evaluator model",
    description="Authenticated Qwen2.5 0.5B inference on Hugging Face ZeroGPU.",
    api_name="chat",
    flagging_mode="never",
)


if __name__ == "__main__":
    demo.queue(default_concurrency_limit=1).launch()

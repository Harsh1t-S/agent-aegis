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
import uvicorn
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from transformers import AutoModelForMultimodalLM, AutoProcessor


MODEL_ID = os.getenv("MODEL_ID", "Qwen/Qwen3.5-0.8B")
MAX_OUTPUT_TOKENS = int(os.getenv("MAX_OUTPUT_TOKENS", "512"))
TOOL_CALL = re.compile(r"<tool_call>\s*(\{.*?\})\s*</tool_call>", re.S)

processor = AutoProcessor.from_pretrained(MODEL_ID)
model = AutoModelForMultimodalLM.from_pretrained(
    MODEL_ID,
    torch_dtype=torch.bfloat16,
    attn_implementation="sdpa",
).eval().to("cuda")


class ChatRequest(BaseModel):
    model: str = MODEL_ID
    messages: list[dict]
    tools: list[dict] = Field(default_factory=list)
    max_tokens: int = 256
    temperature: float = 0.0


def _authorise(authorization: str | None) -> None:
    expected = os.getenv("AEGIS_SPACE_TOKEN", "")
    supplied = (authorization or "").removeprefix("Bearer ").strip()
    if not expected or not secrets.compare_digest(supplied, expected):
        raise HTTPException(401, "Invalid model endpoint credential")


def _normalise_messages(messages: list[dict]) -> list[dict]:
    if not messages or len(messages) > 40:
        raise HTTPException(422, "messages must contain between 1 and 40 turns")
    cleaned = []
    for message in messages:
        role = str(message.get("role") or "")
        if role not in {"system", "user", "assistant", "tool"}:
            raise HTTPException(422, f"Unsupported message role: {role}")
        cleaned.append({key: value for key, value in message.items()
                        if key in {"role", "content", "tool_calls", "tool_call_id"}})
    return cleaned


def _generate(messages: list[dict], tools: list[dict], max_tokens: int,
              temperature: float) -> tuple[str, int, int]:
    template_options = {
        "add_generation_prompt": True,
        "tokenize": True,
        "return_dict": True,
        "return_tensors": "pt",
    }
    if tools:
        template_options["tools"] = tools[:32]
    inputs = processor.apply_chat_template(messages, **template_options).to(model.device)
    prompt_tokens = int(inputs["input_ids"].shape[-1])
    if prompt_tokens > 8192:
        raise ValueError("Input exceeds the pilot endpoint's 8192-token limit")
    do_sample = temperature > 0
    with torch.inference_mode():
        output = model.generate(
            **inputs,
            max_new_tokens=min(max(max_tokens, 1), MAX_OUTPUT_TOKENS),
            do_sample=do_sample,
            temperature=max(temperature, 0.01) if do_sample else None,
            top_p=1.0,
        )
    generated = output[0][prompt_tokens:]
    text = processor.decode(generated, skip_special_tokens=False).strip()
    return text, prompt_tokens, int(generated.shape[-1])


@spaces.GPU(duration=60)
def generate(messages: list[dict], tools: list[dict], max_tokens: int,
             temperature: float) -> tuple[str, int, int]:
    return _generate(messages, tools, max_tokens, temperature)


def _message(text: str) -> dict:
    calls = []
    for index, match in enumerate(TOOL_CALL.finditer(text)):
        try:
            item = json.loads(match.group(1))
            name = item.get("name")
            arguments = item.get("arguments") or {}
            if name:
                calls.append({
                    "id": f"call_{index}_{uuid.uuid4().hex[:8]}",
                    "type": "function",
                    "function": {
                        "name": name,
                        "arguments": json.dumps(arguments),
                    },
                })
        except (TypeError, json.JSONDecodeError):
            continue
    content = TOOL_CALL.sub("", text)
    content = re.sub(r"<think>.*?</think>", "", content, flags=re.S).strip()
    return {"role": "assistant", "content": content or None,
            **({"tool_calls": calls} if calls else {})}


api = FastAPI(title="Aegis Hugging Face model endpoint")


@api.get("/health")
def health():
    return {"status": "ok", "model": MODEL_ID, "hardware": "ZeroGPU"}


@api.post("/v1/chat/completions")
def chat(request: ChatRequest, authorization: str | None = Header(default=None)):
    _authorise(authorization)
    started = int(time.time())
    text, prompt_tokens, completion_tokens = generate(
        _normalise_messages(request.messages), request.tools,
        request.max_tokens, request.temperature,
    )
    message = _message(text)
    return {
        "id": f"chatcmpl-{uuid.uuid4().hex}",
        "object": "chat.completion",
        "created": started,
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


@spaces.GPU
def demo_reply(prompt: str) -> str:
    # The directly registered Gradio dependency lets ZeroGPU discover the GPU
    # workload while the separate decorated function serves the REST endpoint.
    text, _, _ = _generate([{"role": "user", "content": prompt}], [], 160, 0.0)
    return _message(text).get("content") or "The model requested a tool call."


with gr.Blocks() as demo:
    gr.Markdown("# Aegis evaluator model\nQwen3.5 0.8B on ZeroGPU for bounded pilot evaluations.")
    gr.Interface(fn=demo_reply, inputs=gr.Textbox(label="Pilot prompt"),
                 outputs=gr.Textbox(label="Response"), flagging_mode="never")

app = gr.mount_gradio_app(api, demo, path="/")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)

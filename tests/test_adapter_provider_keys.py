from app.adapters import LLMAgentAdapter


def test_google_only_key_keeps_google_candidate(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    monkeypatch.setenv("GOOGLE_API_KEY", "google-test-key")

    adapter = LLMAgentAdapter(
        models=["groq:openai/gpt-oss-20b", "google:gemini-flash-lite-latest"]
    )
    order = adapter._configured_order({"messages": [{"content": "hello"}]})

    assert [candidate for candidate, *_ in order] == ["google:gemini-flash-lite-latest"]
    assert order[0][3] == "google-test-key"


def test_missing_provider_key_is_skipped_instead_of_sent_as_empty_bearer(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "groq-test-key")
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("LLM_API_KEY", raising=False)

    adapter = LLMAgentAdapter(
        models=["google:gemini-flash-lite-latest", "groq:openai/gpt-oss-20b"]
    )
    order = adapter._configured_order({"messages": [{"content": "hello"}]})

    assert [candidate for candidate, *_ in order] == ["groq:openai/gpt-oss-20b"]
    assert all(key for *_, key in order)


def test_no_configured_provider_produces_empty_routable_pool(monkeypatch):
    for key in ("GROQ_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY",
                "OPENROUTER_API_KEY", "LLM_API_KEY"):
        monkeypatch.delenv(key, raising=False)

    adapter = LLMAgentAdapter(models=["google:gemini-flash-lite-latest"])
    assert adapter._configured_order({"messages": [{"content": "hello"}]}) == []

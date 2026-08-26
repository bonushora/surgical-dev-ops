# NATURAL qualified OpenAI frontier provider

ADR-024-G qualifies the first remote frontier boundary using the OpenAI
Responses API. The adapter fixes provider identity, model, endpoint, cognitive
capabilities, request and response bounds, timeout, typed streaming lifecycle
and fail-closed completion semantics.

The credential is obtained only inside the transport boundary and is never
returned through evidence, errors, memory, telemetry or presentation. Requests
disable provider tools and storage. Stream deltas are presentation-only; only a
complete validated JSON result may enter the cognitive evidence boundary.

Guided setup requires current official commercial information, privacy
disclosure and explicit human choice. Choice alone does not activate the
provider or grant authority. Local Gemma and Qwen profiles remain available,
and no remote provider is selected automatically.

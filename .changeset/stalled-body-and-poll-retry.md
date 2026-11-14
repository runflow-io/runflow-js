---
"@runflow-io/sdk": patch
---

Keep the request timeout armed while the response body is read, and keep polling through dropped connections, request timeouts and 429s.

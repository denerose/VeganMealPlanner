# TODO

- [ ] **Add request logging to the API** — The server has zero request logging (no method, path, status, or duration). Add a lightweight wrapper in `createFetchHandler` that logs `{method, path, status, duration}` before returning the response.

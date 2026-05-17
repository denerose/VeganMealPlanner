# TODO

- [ ] **Add request logging to the API** — The server has zero request logging (no method, path, status, or duration). Add a lightweight wrapper in `createFetchHandler` that logs `{method, path, status, duration}` before returning the response.
- [ ] **Extract duplicate "exists check + 404" pattern into a shared helper** — Nearly every service repeats: find record scoped by `householdId`, throw `ApiProblem(404)` if missing, then proceed. A helper like `requireScoped(prisma, model, householdId, id, label)` would cut boilerplate and ensure consistent 404 messaging across endpoints.

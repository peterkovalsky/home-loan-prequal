# Plan: property address suggestions (Addressfinder)

Status: **done.** Client side only, as agreed.

## Goal

When the customer knows the property address, suggest real Australian addresses as they type, so the address is spelled the way the national address file has it. Typing an address by hand still works, for new builds and vacant land that aren't listed yet.

## Decisions

| Topic | Decision | Why |
|---|---|---|
| Provider | **Addressfinder**, AU autocomplete API | G-NAF data, which is what lenders use for valuations and property data. Self-serve account. |
| Where it's called | **From the browser**, with the public key only | Addressfinder authenticates browser calls by key plus allowed domains; the secret is for server-to-server calls and is never used or stored. The API's Lambda has no internet route (no NAT), so a server-side proxy would cost a NAT gateway. |
| Widget or own component | **Our own combobox component**, calling the REST endpoint with `HttpClient` | The vendor widget edits the DOM behind Angular's back. Our own component is `OnPush`, a `ControlValueAccessor` that drops into the reactive form, accessible (ARIA combobox pattern, keyboard support), and unit-testable. |
| Swapping providers | An `AddressLookup` abstraction; Addressfinder is one implementation | Changing to Geoscape, Google or AWS Location changes one class. |
| Configuration | Optional `addressFinderKey` in `config.json` | Runtime config, like the API URL. With no key, the field is a plain text input, so nothing breaks. |
| What is saved | The chosen address text, exactly as today | No server or schema change. The server still validates it (required, 200 characters). Storing the G-NAF id is a later step (see below). |
| Failure | Errors and timeouts show no suggestions; typing continues | A suggestion is a convenience, never a gate. |
| Tests | Unit tests for the lookup, the component (debounce, keyboard, mouse, errors) and the config; one Playwright journey with Addressfinder stubbed by `page.route` | CI never depends on, or spends quota at, the vendor. |

## Found while planning

The mock-API interceptor decides what to intercept by URL **path** only. Addressfinder's path also starts with `/api/`, so in mock mode its calls would be answered by the mock with 404. The interceptor must also match the API's origin.

## Behaviour

- Suggestions start after 3 characters and are debounced (250 ms). A newer query cancels an older one.
- Up and Down move through suggestions, Enter picks one, Escape closes the list. A click picks one.
- Up to 6 suggestions are shown, with a hint that the address can also be typed in.

## Later (not in this change)

- Store the G-NAF id (`canonical_address_id`), plus the parsed state and postcode, in a new migration. The server then checks them with Addressfinder's verification API, using the secret, server side.
- Restrict the key to the real domains in the Addressfinder portal when the front end is deployed. Today it serves `localhost`.

## As built

| Planned | Built | Why |
|---|---|---|
| Suggestions for any address | `post_box=0`: PO boxes excluded | A property can't be a PO box. Checked against the live API first. |
| — | The E2E journey sets its own test key through the `config.json` rewrite, and the stub refuses any other key | The test proves the key goes from config to the request, and it doesn't depend on the committed config files. |
| — | `scripts/write-aws-config.sh` now updates only `apiBaseUrl` | It used to rewrite the whole file, which would have dropped the key on every deploy. |
| — | Two lint rules suppressed on the options, with a comment | In the combobox pattern, options aren't focusable: the input owns focus and the keyboard. |

Checked by hand against the real Addressfinder service in the browser: typing, the list position, the highlight with the arrow keys, Enter to pick, and Escape.

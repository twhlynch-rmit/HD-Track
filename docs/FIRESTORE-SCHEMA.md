# Firestore Schema

## Overview

All collections use the typed collection pattern — see `frontend/src/lib/firebase/firestore.ts`.
Security rules are in `firebase/firestore.rules`.

When adding a new collection, use the `/firebase-collection` Claude Code skill.

## Schema versioning

Every document in every collection **must** include a `_schemaVersion` field:

```typescript
_schemaVersion: 1  // increment when doing a breaking schema change
```

This enables **lazy migration** — when a document is read, check `_schemaVersion` and migrate on the fly if it's behind current. See the `/evolve-schema` skill for the full migration workflow.

**Rules:**
- `_schemaVersion` is always `1` on creation
- Non-breaking changes (adding optional fields with defaults) keep the same version
- Breaking changes (rename, remove, type change) increment the version and require a migration function
- Never remove `_schemaVersion` from a schema

---

## `users` collection

**Path:** `/users/{userId}`
**Access:** Owner-only (user can read/write their own document; admins can read all)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | `string` | Yes | Firebase Auth UID (same as document ID) |
| `email` | `string` | Yes | User's email address |
| `displayName` | `string \| null` | Yes | Display name from Auth or profile |
| `photoURL` | `string \| null` | Yes | Profile photo URL |
| `role` | `'user' \| 'admin'` | Yes | User role — immutable by user after creation |
| `createdAt` | `Timestamp` | Yes | When the document was created |
| `updatedAt` | `Timestamp` | Yes | When the document was last updated |
| `_schemaVersion` | `1` | Yes | Schema version for lazy migration |

**Creation:** Auto-created by `AuthProvider` on first sign-in via `syncUserProfile()`.
**Deletion:** Hard-delete is disabled in security rules. Use `deletedAt` field for soft-delete.

---

## `locations` collection

**Path:** `/locations/{locationId}`
**Access:** **Server-only** — no client reads or writes; the nearby Route Handler and seed script use the Admin SDK

Reference data for the **Locator** feature — the places a user can find.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Display name (1–200 chars) |
| `category` | `'pickup' \| 'service' \| 'depot' \| 'partner'` | Yes | Category filter — same union as `frontend/src/features/locator/constants.ts` |
| `address` | `string` | Yes | Street address shown under the name |
| `lat` | `number` | Yes | Latitude (−90…90) |
| `lng` | `number` | Yes | Longitude (−180…180) |
| `geohash` | `string` | Yes | Geohash of `(lat, lng)`, precision 9 — the field the nearby range query filters on |
| `active` | `boolean` | Yes | `false` retires a location; the API drops it from results |
| `createdBy` | `string \| null` | Yes | UID of the creating admin, or `'seed-script'` |
| `createdAt` | `Timestamp` | Yes | Creation time |
| `updatedAt` | `Timestamp` | Yes | Last update time |
| `_schemaVersion` | `1` | Yes | Schema version for lazy migration |

**Creation:** `pnpm --filter backend seed:locations` (Admin SDK, bypasses rules) or other server-side tooling.
**Why server-only:** coordinates decide ranking, so a client must never be able to read or forge them. Firestore rules deny all client access; the `/api/locations/nearby` Route Handler reads this collection with the Admin SDK (`frontend/src/app/api/locations/nearby/route.ts`).

---

## `visits` collection

**Path:** `/visits/{visitId}`
**Access:** Owner-only — a user reads only their own visits, and can create but never edit or delete them

A visit a user logs against a location from the Locator results list.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | `string` | Yes | The visitor's Firebase Auth UID (used by the read rule) |
| `locationId` | `string` | Yes | Document ID of the location visited (1–128 chars) |
| `locationName` | `string` | Yes | Name denormalised at write time — the list renders without a read per row |
| `visitedAt` | `Timestamp` | Yes | When the visit was logged |
| `createdAt` | `Timestamp` | Yes | Creation time (same value as `visitedAt`) |
| `_schemaVersion` | `1` | Yes | Schema version for lazy migration |

**Creation:** `logVisit()` Server Action (`frontend/src/features/locator/actions/visits.actions.ts`) — it re-reads the location server-side, so a visit can only point at a real, active location.
**Rules validation:** the create rule also checks that `uid` matches the caller, the key set is exact, `visitedAt`/`createdAt` equal `request.time`, the referenced `locations` document exists and is `active`, and `locationName` matches that document's `name`.
**Deletion:** Disabled in rules; visits are immutable history.
**Reads:** `useVisits(uid)` subscribes with `where('uid', '==', uid)`; sorting happens in the UI, so no composite index is needed.

---

<!-- Add new collection schemas below using the /firebase-collection skill -->

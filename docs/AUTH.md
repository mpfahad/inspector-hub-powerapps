# IRPPMS authentication

UAT uses **local email + password** and an httpOnly cookie `irppms_token` (8h JWT). The API reloads the user (including **role**) from the database on each request so role changes apply without waiting for the cookie to expire.

## Current login path

1. `POST /api/auth/login` with email/password.
2. `authenticateLocal` in `server/src/services/identity.ts` checks `identityProvider=local` and `passwordHash`.
3. The same session cookie JWT is set (`irppms_token`). Inspectors are authorized by `Inspector.userId` (email is display/notices only).

There is **no** “Login with Microsoft” button in this build. Do not add one until the Entra app is registered and the OIDC flow can be tested.

## Schema fields (Entra-ready)

| Field | Purpose |
|-------|---------|
| `User.identityProvider` | `local` (default) or `entra` |
| `User.externalSubject` | Entra object id (`oid`), unique when set |
| `User.passwordHash` | Required for local users; **null** for Entra-only users |
| `Inspector.userId` | FK to `User` — preferred for authz |
| `Inspector.email` | Display and notices |

## How Entra (Azure AD) plugs in next

When IT provides an Entra app registration (client id, tenant id, redirect URI):

1. Add an OIDC callback route (authorization code + ID token validation). Do **not** replace the session cookie format.
2. After a valid ID token, call a real implementation of `loadOrLinkEntraUser`:
   - Match `oid` → `User.externalSubject`
   - Else match email, set `externalSubject` + `identityProvider=entra`, clear or leave `passwordHash` null
   - Issue the **same** `irppms_token` cookie via `signToken` / `sessionCookieOptions`
3. Keep local login for UAT accounts (`identityProvider=local`) until cutover.

### App roles / groups → `UserRole`

Configure Entra **app roles** (preferred) or security groups and map claims:

| Entra app role (or group) | IRPPMS `UserRole` |
|---------------------------|-------------------|
| `IRPPMS.Admin` | Admin |
| `IRPPMS.Manager` | Manager |
| `IRPPMS.Coordinator` | Coordinator |
| `IRPPMS.Inspector` | Inspector |

If a user has multiple roles, take the highest privilege: Admin > Manager > Coordinator > Inspector.

**Admin-only (CM-013):** inspector Daily CTC / Daily billable / cost history, and `GET /api/reports/costs`. Commercial job price and the price chart remain available to Coordinator and Manager.

Unmapped users should not receive a session.

## Ports and cookie

Unchanged: web **5180**, API **4100**, cookie name **`irppms_token`**. See `docs/PORTS.md`.

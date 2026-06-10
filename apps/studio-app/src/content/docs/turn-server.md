---
title: Hosting a TURN server
description: Set up a TURN relay so Live works across devices on restrictive campus and guest Wi-Fi networks.
order: 7
updated: 2026-05-29
---

# Hosting a TURN server

Kukui Live connects devices directly, peer-to-peer, over WebRTC — there's no Kukui server relaying the session. For that direct connection to form, each device has to find a path through its network's NAT and firewall. Most home and single-LAN setups manage this with **STUN** alone (always configured, nothing to do). But some networks block direct peer-to-peer entirely, and on those the *only* way two devices reach each other is by bouncing traffic through a **TURN** relay.

If Live works between tabs on one computer but **other devices just sit on "waiting for the instructor,"** that's the signature of a network that needs TURN. It's common on:

- **eduroam and other enterprise Wi-Fi** with symmetric NAT
- **Guest / public Wi-Fi** with *client isolation* (AP isolation), which deliberately blocks device-to-device traffic
- Networks that block outbound UDP

There is no public TURN baked into Kukui — a TURN relay carries all of a session's traffic, so it has to be an endpoint your institution controls and trusts. This guide walks through standing one up.

> **Why not GitHub?** A TURN server is a long-running daemon that needs a public IP and open relay ports. GitHub Pages serves static files only, and GitHub Actions runners are ephemeral — neither can host it. TURN belongs on a small always-on VPS.

## What you need

- A small **VPS** with a public IP — Fly.io, Hetzner, DigitalOcean, AWS Lightsail, or Oracle Cloud's always-free tier all work. A 1 vCPU / 1 GB box is plenty for a classroom.
- A **domain or subdomain** pointed at the VPS (e.g. `turn.kukui.your-school.edu`) — needed for the TLS certificate.
- About 20 minutes.

## 1. Install coturn

[coturn](https://github.com/coturn/coturn) is the standard open-source TURN/STUN server. On Debian/Ubuntu:

```bash
sudo apt update && sudo apt install -y coturn
sudo sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
```

## 2. Get a TLS certificate

Use `turns:` (TURN over TLS, port 5349) as your primary endpoint — it survives networks that only allow outbound 443/TLS, which is exactly where you need TURN most. Issue a cert with Let's Encrypt:

```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d turn.kukui.your-school.edu
```

## 3. Configure coturn

Edit `/etc/turnserver.conf` (replace the realm, domain, and secret):

```ini
# Listen for STUN/TURN
listening-port=3478
tls-listening-port=5349

# Public hostname + TLS cert from step 2
realm=turn.kukui.your-school.edu
cert=/etc/letsencrypt/live/turn.kukui.your-school.edu/fullchain.pem
pkey=/etc/letsencrypt/live/turn.kukui.your-school.edu/privkey.pem

# Time-limited credentials (recommended) — clients authenticate with an
# HMAC of the username, so you never ship a static password.
use-auth-secret
static-auth-secret=REPLACE_WITH_A_LONG_RANDOM_SECRET

# Lock it down
no-cli
fingerprint
# Restrict the relay port range and open the same range in your firewall
min-port=49152
max-port=65535
```

Open the ports in your VPS firewall: TCP/UDP **3478** and **5349**, plus UDP **49152–65535**. Then start it:

```bash
sudo systemctl enable --now coturn
```

> **Static credentials instead?** For a quick test you can swap `use-auth-secret` for `user=myuser:mypassword` and `lt-cred-mech`. Fine for a pilot; prefer time-limited credentials for anything ongoing.

## 4. Point Kukui Live at it

Live resolves TURN from the most specific source to the least, so you can set a default for everyone *and* still override per session. From highest to lowest priority:

| Source | How | Use it for |
|---|---|---|
| URL param | `?turn=turns:turn.your-school.edu:5349&turnUser=<u>&turnCred=<c>` | Quick tests, one-off troubleshooting |
| Lobby setting | **Advanced → connection → Use a custom TURN server** | An instructor on a known-bad network |
| Activity config | `live.turn = { url, username, credential }` in the activity JSON | Baking a relay into a specific activity |
| Build default | `VITE_KUKUI_TURN_*` env vars (below) | Every session, zero per-instructor setup |

For the build-time default, set these in your deploy/CI environment before building Studio + Live:

```bash
VITE_KUKUI_TURN_URL=turns:turn.kukui.your-school.edu:5349
VITE_KUKUI_TURN_USER=<username>     # optional
VITE_KUKUI_TURN_CRED=<credential>   # optional
```

Every deployed build then uses your relay automatically, and the lobby's TURN picker shows **"Use built-in relay (recommended)."**

## 5. Verify it works

1. Open Trickle ICE: <https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/>
2. Remove the default servers, add yours (`turns:turn.kukui.your-school.edu:5349` with the username/credential), and click **Gather candidates**.
3. You should see candidates of type **`relay`**. If you do, TURN is working.

Then do the real test: join the same Live room from **two devices on different networks** (e.g. a laptop on Wi-Fi and a phone on cellular). They should connect instead of hanging on "waiting for the instructor."

## Troubleshooting

- **No `relay` candidates in Trickle ICE** — the relay ports (49152–65535/UDP) or 5349 are closed in the VPS firewall, or the credentials are wrong.
- **Works on Trickle ICE but not in Live** — double-check the URL scheme (`turns:` for TLS on 5349, `turn:` for 3478) and that the credentials reaching Live match the server.
- **TLS errors** — the cert hostname must match the `turns:` host exactly, and the cert must be readable by the `turnserver` user.
- **Still stuck on one network only** — confirm the value is actually reaching the client: a per-session `?turn=` is the easiest way to rule out a misconfigured build default.

## Related

- [Live mode](/docs/live-mode) — what Live is and which activities support it
- [Self-hosting](/docs/self-hosting) — running your own Studio instance

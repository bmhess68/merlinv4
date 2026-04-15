# MerlinV4 TODO

## Code Locations

| Location | What | Status |
|----------|------|--------|
| `/var/www/html/` | **Production server** (running, systemd `merlin.service`) | Live, `mobile` branch of MerlinV3 |
| `/home/wcpd/mapv2/` | **Old dev copy** (subset of features, never ran in prod) | Archived |
| `github.com/bmhess68/MerlinV4` | **Full production snapshot** pushed 2026-04-15 | Source of truth for rewrite |
| `github.com/bmhess68/MerlinV3` | Previous repo (has secret history, don't reuse) | Archived |

---

## Production Inventory (what exists today)

### Backend (Node/Express -- `src/server.js`, 30KB)
- Slack OAuth login (OpenID Connect)
- Socket.IO for real-time push
- SSE (Server-Sent Events) for live updates
- Slack webhook receiver (`/slack/events`) -- monitors Hotline channel
- Slack file proxy (`/slack/files`) -- serves thumbnails
- PostgreSQL via `pg` (incidents, markers, drawn items, vehicles, roster)
- Redis via `ioredis` (vehicle location cache)
- Vehicle geofencing cron (entry/exit tracking)
- Incident report generator (`.txt` + `.html` to local files)
- CAD alert service (email-based)
- Weather overlay service
- StarChase integration
- Address search / reverse geocoding
- OSRM routing (optional local or remote)
- Overpass POI queries (optional local or remote)

### Backend Services (Python)
- `backend/fetch_data.py` -- Zello vehicle locations (1s poll -> POST to Node)
- `backend/firelocations.py` -- FleetComplete fire vehicles (10s poll -> POST to Node)
- `scripts/run_service.py` -- CAD email monitor service

### Frontend (React 18 + CRA)
- **Desktop map**: Leaflet with incidents, markers, drawn items, CSV layers, vehicle tracking
- **Mobile map**: Two variants (Leaflet-based `MobileMap.js` and Mapbox-based `MapboxMobileMap.js`)
- Admin panel, user permissions, database manager
- Vehicle roster, vehicle search
- Layer control, drawing tools
- CAD alerts component, weather alerts
- Slack login flow

### Infrastructure
- nginx reverse proxy -> Node :3000
- systemd services: `merlin.service`, `cad-monitor.service`
- Redis on localhost
- PostgreSQL on localhost (`incidentdb`)
- Docker: OSRM + Overpass (optional)

---

## Current Issues in Production

### Slack
- [ ] **Slack reports not delivered** -- Reports only write local `.txt`/`.html` files. Last report: Aug 2024 (incident 163). No Slack/email delivery exists.
- [ ] **2,107 messages skipped** as "non-monitored user" since April 9 -- review monitored user list
- [ ] **120 `file_not_found` errors** -- Slack thumbnail fetch failures for deleted/inaccessible files
- [ ] **1,197 SSE `aborted` errors** -- clients disconnecting, possibly aggressive reconnect

### Integration
- [ ] **Redis key mismatch** -- `fetch_data.py` writes `zello_locations` (string), `app.py` writes `locations` (hash), Node cron reads `locations` (hash)
- [ ] **3 duplicate Zello fetchers** with different intervals/filters
- [ ] **Port 5000 collision** between Flask apps and OSRM

### Security
- [ ] **API routes mostly unauthenticated** -- data mutation endpoints open
- [ ] **Auth bypass still in code** -- `isUserAuthorized()` returns true
- [ ] **SKIP_SLACK_VERIFICATION=true** in production `.env`

### Performance
- [ ] **Triple browser polling** (incidents 5s + vehicles 1s + geofencing 1s)
- [ ] **N+1 DB queries** in vehicle geofencing
- [ ] **Stale vehicle markers** never removed from map

---

## Mobile Usage Analysis

- Production has `mobileMode=true` parameter and two mobile map components
- Only ONE user tested it (March 2025, from desktop Chrome)
- Zero actual phone traffic detected in available logs
- **Decision**: Drop separate mobile codebase; V4 uses responsive Mapbox GL (one codebase)

---

## What Carries Over vs. What Gets Dropped

### Keep (port logic to TypeScript)
- Slack OAuth login flow
- Incident CRUD + geofencing logic
- Vehicle tracking (Zello + FleetComplete) -- consolidated into one pipeline
- Drawn items / markers system
- Incident report generation (upgrade: deliver via Slack + email)
- Vehicle roster
- Weather alerts (OpenWeather)
- StarChase integration
- Address search / geocoding
- Admin panel + user permissions
- Special resources

### Drop
- All polling from browser (replace with WebSocket push)
- CRA build tooling (replace with Vite)
- Duplicate Leaflet + Mapbox implementations (pick Mapbox GL only)
- Three duplicate `fetch_data.py` scripts (one unified TypeScript worker)
- Client-side geofencing (move to server only)
- `AppWSlack.js`, `TestComponent.js`, all dead code
- Redis as dumb cache (upgrade to pub/sub message bus between workers)
- Separate mobile codebase

### New Features
- Direct CAD API integration (Tyler/Hexagon)
- Rekor LPR integration + BOLO system
- RTSP camera streaming on map (go2rtc/MediaMTX)
- Per-user home location
- Unified notification system (Slack + in-app + email)
- Incident timeline/playback
- Analytics dashboard (incident heatmaps, response times)
- Audit trail v2 (law enforcement compliance)
- Multi-agency coordination (shared incident views)

---

## V4 Architecture

### Project Structure (TypeScript Monorepo)

```
merlinv4/
  packages/
    server/           # Express/Fastify API + Socket.IO
      src/
        routes/       # REST endpoints
        middleware/    # auth, audit, rate-limit
        services/     # business logic
        workers/      # background jobs (vehicle fetch, CAD, LPR, cameras)
        db/           # migrations, queries, connection pool
    web/              # React frontend (Vite, not CRA)
      src/
        pages/        # MapPage, AdminPage, RosterPage, LoginPage
        components/   # map layers, modals, toolbar
        services/     # socket client, API client
        hooks/        # useVehicles, useIncidents, useCAD, useLPR
    shared/           # TypeScript types, constants, validation schemas
  docker/             # Compose for OSRM, Overpass, RTSP relay
  scripts/            # DB migrations, seed data, deploy
```

### Data Flow

```
External APIs (Zello, Fleet, CAD, LPR, Cameras)
        |
  Background Workers (TypeScript, server/src/workers/)
        |
  Redis 7 (pub/sub channels: vehicles:updates, cad:updates, lpr:reads)
        |
  Express/Fastify Server (Socket.IO broadcast)
        |
  Browser Client (Mapbox GL, WebSocket-driven, zero polling)
```

---

## New Feature Details

### 1. Direct CAD API Integration

**Current state**: email scraping from `_IPAGE@westchestergov.com`, disabled in UI, two competing parsers (Python + Node).

**V4 approach**:
- [ ] Worker polls CAD API (Tyler/Hexagon/Motorola) on configurable interval (5-15s)
- [ ] Fetches active calls, units assigned, call status, priority, location
- [ ] Stores in `cad_calls` table with PostGIS geometry
- [ ] Publishes to Redis pub/sub channel `cad:updates`
- [ ] Server broadcasts via Socket.IO `cad-update` event
- [ ] Map layer shows active CAD calls (color-coded by priority/type)
- [ ] Click a call for full details, assigned units, timeline
- [ ] Auto-link CAD calls to Merlin incidents when location/type match
- [ ] Keep email fallback as degraded mode if API goes down

### 2. Rekor LPR Integration

**New feature**. Rekor provides REST API and webhook system.

- [ ] Webhook receiver endpoint `POST /api/lpr/events` for real-time plate reads
- [ ] Worker also polls Rekor API for reads in coverage area
- [ ] `lpr_reads` table (plate, camera_id, location, timestamp, image_url, confidence)
- [ ] BOLO system: `bolo_plates` table (plate, reason, priority, added_by, expires_at)
- [ ] BOLO match triggers instant Socket.IO alert + Slack notification
- [ ] Map layer shows LPR camera locations; click for recent reads
- [ ] Search by plate number across historical reads
- [ ] Heatmap mode: density of reads over time for patrol analysis
- [ ] Configurable alert rules (stolen vehicle list, out-of-state plates in zones)

### 3. RTSP Camera Streaming on Map

Mixed RTSP/ONVIF IP cameras. Browser cannot play RTSP directly.

- [ ] Camera registry table: `cameras` (id, name, rtsp_url, onvif_url, lat/lng, status, zone)
- [ ] Transcoder service (go2rtc or MediaMTX) in Docker
- [ ] Each camera gets HLS endpoint `/cameras/{id}/stream.m3u8` or WebRTC for low latency
- [ ] Map layer shows camera icons at their locations
- [ ] Click opens floating video player with live feed
- [ ] Multiple cameras viewable simultaneously (tiled or floating)
- [ ] Incident linking: suggest nearby cameras when creating/viewing incidents
- [ ] PTZ control (if ONVIF supports it) from map UI
- [ ] Snapshot button captures frame, attaches to incident as evidence
- [ ] Admin panel for add/edit/remove cameras, test connectivity, view status

### 4. Per-User Home Location
- [ ] Store in `users` table: `home_lat`, `home_lng`, `home_zoom`
- [ ] Home button centers on user's configured location
- [ ] Admin can set defaults per role/agency

### 5. Incident Timeline / Playback
- [ ] Record all vehicle positions, CAD events, LPR reads during active incident
- [ ] After close, provide timeline scrubber to replay events on map
- [ ] Exportable as video or PDF report

### 6. Analytics Dashboard
- [ ] Response time metrics (incident create to first vehicle arrival)
- [ ] Incident heatmaps by type, time of day, day of week
- [ ] Vehicle utilization (time in service, distance covered)
- [ ] LPR hit rate, BOLO match rate
- [ ] Trend analysis over configurable time periods

### 7. Enhanced Notifications
- [ ] Unified notification center (in-app sidebar)
- [ ] Configurable per-user: which alerts go to Slack DM, email, in-app toast
- [ ] Priority levels: critical (audible + persistent), info (toast only)

### 8. Audit Trail v2
- [ ] Every data mutation logged with user, timestamp, before/after
- [ ] Searchable, filterable, exportable
- [ ] Required for law enforcement compliance

### 9. Multi-Agency Coordination
- [ ] Shared incident view across agencies (read-only links, no auth for view-only)
- [ ] Mutual aid request workflow
- [ ] Shared map annotations

---

## Rewrite Phases

### Phase 1: Foundation (Week 1-2)
- [ ] New server provisioning (Node 20 LTS, PostgreSQL 16, Redis 7)
- [ ] Monorepo scaffold (TypeScript, Vite, Express/Fastify)
- [ ] PostgreSQL schema design + migrations (carry forward existing tables, add new)
- [ ] Auth system (Slack OIDC, session management, permissions)
- [ ] CI/CD pipeline (GitHub Actions -> new server)
- [ ] Export production database for seed data

### Phase 2: Core Map + Vehicles (Week 3-4)
- [ ] Mapbox GL map (single codebase, responsive for desktop + mobile)
- [ ] Unified vehicle pipeline (Zello + FleetComplete workers -> Redis pub/sub -> Socket.IO)
- [ ] Incident CRUD + geofencing (server-side)
- [ ] Drawn items / markers
- [ ] Per-user home location
- [ ] Vehicle roster

### Phase 3: Existing Integrations (Week 5-6)
- [ ] Slack webhook receiver + notification push
- [ ] Slack file proxy
- [ ] Incident reports (generate + deliver to Slack channel + email)
- [ ] Weather overlay + alerts
- [ ] StarChase layer
- [ ] Address search / geocoding
- [ ] Admin panel + user permissions
- [ ] Special resources

### Phase 4: CAD Integration (Week 7-8)
- [ ] CAD API worker + data model
- [ ] Real-time CAD calls on map
- [ ] CAD-to-incident auto-linking
- [ ] CAD call detail view
- [ ] Email fallback monitor (legacy)

### Phase 5: LPR Integration (Week 9-10)
- [ ] Rekor API worker + webhook receiver
- [ ] LPR reads data model
- [ ] BOLO system (create, match, alert)
- [ ] LPR camera layer on map
- [ ] Plate search + history
- [ ] Slack/in-app alerts on BOLO hits

### Phase 6: Camera Streaming (Week 11-13)
- [ ] Camera registry + admin UI
- [ ] go2rtc or MediaMTX Docker setup
- [ ] RTSP-to-HLS/WebRTC transcoding
- [ ] Camera layer on map + video player
- [ ] Incident-linked camera suggestions
- [ ] Snapshot/evidence capture

### Phase 7: Analytics + Polish (Week 14-16)
- [ ] Incident timeline/playback
- [ ] Analytics dashboard (heatmaps, response times, trends)
- [ ] Notification center
- [ ] Audit trail v2
- [ ] Performance optimization + load testing
- [ ] Migration plan: run V4 alongside V3, migrate database, DNS cutover, decommission old server

---

## Old Notes (from production next.txt and changelog)

- Favicon and title customization
- Bring over all Slack code from .94 including emails and log files
- Run multiple server ports (ask Ken)
- Change geojson timing
- StarChase integration added (v3)
- Security/logging refactors done (v3)
- Mobile branch created but underutilized

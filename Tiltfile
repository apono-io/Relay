# Relay Tiltfile
# Orchestrates the local development environment (Postgres + backend + frontend).

# Port overrides — let a second stack run alongside the main one without colliding.
# Defaults match backend/.env (PORT=3100) and frontend/vite.config.ts (5174, strictPort).
backend_port = os.getenv('RELAY_BACKEND_PORT', '3100')
frontend_port = os.getenv('RELAY_FRONTEND_PORT', '5174')

# Postgres runs in a container (host port 5433 to avoid clashing with other local envs).
docker_compose('./docker-compose.yml')
dc_resource('postgres', labels=['infra'])

local_resource(
  'frontend-install',
  cmd='cd frontend && yarn install',
  deps=['frontend/package.json'],
  labels=['setup']
)

local_resource(
  'backend-install',
  cmd='cd backend && yarn install',
  deps=['backend/package.json'],
  labels=['setup']
)

# Backend waits for Postgres (compose creates the `relay` database on first start).
# Migrations run automatically at boot (migrationsRun: true).
local_resource(
  'backend',
  cmd='echo "Starting backend"',
  serve_cmd='cd backend && PORT=%s yarn start:dev' % backend_port,
  deps=['backend/src'],
  ignore=['backend/src/schema.gql'],
  resource_deps=['backend-install', 'postgres'],
  readiness_probe=probe(
    period_secs=5,
    http_get=http_get_action(port=int(backend_port), path='/health'),
  ),
  labels=['backend'],
  links=[
    link('http://localhost:%s' % backend_port, 'Backend API'),
    link('http://localhost:%s/graphql' % backend_port, 'GraphQL Playground')
  ]
)

local_resource(
  'frontend',
  cmd='echo "Starting frontend"',
  serve_cmd='cd frontend && yarn dev --port %s --strictPort' % frontend_port,
  deps=['frontend/src'],
  resource_deps=['frontend-install'],
  readiness_probe=probe(
    period_secs=5,
    http_get=http_get_action(port=int(frontend_port), path='/'),
  ),
  labels=['frontend'],
  links=[link('http://localhost:%s' % frontend_port, 'Relay UI')]
)

# Roster seed — reads commit author emails from GitHub and fills `people`.
# Manual trigger: run it from the Tilt UI after a backfill; re-running is safe.
local_resource(
  'seed-people',
  cmd='cd backend && yarn seed-people',
  resource_deps=['backend'],
  trigger_mode=TRIGGER_MODE_MANUAL,
  auto_init=False,
  labels=['backend']
)

print("Relay Frontend: http://localhost:%s" % frontend_port)
print("Relay Backend:  http://localhost:%s" % backend_port)
print("GraphQL:        http://localhost:%s/graphql" % backend_port)

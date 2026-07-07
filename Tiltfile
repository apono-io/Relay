# Relay Tiltfile
# Orchestrates the local development environment (Postgres + backend + frontend).

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
local_resource(
  'backend',
  cmd='echo "Starting backend"',
  serve_cmd='cd backend && yarn start:dev',
  deps=['backend/src'],
  ignore=['backend/src/schema.gql'],
  resource_deps=['backend-install', 'postgres'],
  readiness_probe=probe(
    period_secs=5,
    http_get=http_get_action(port=3000, path='/health'),
  ),
  labels=['backend'],
  links=[
    link('http://localhost:3000', 'Backend API'),
    link('http://localhost:3000/graphql', 'GraphQL Playground')
  ]
)

local_resource(
  'frontend',
  cmd='echo "Starting frontend"',
  serve_cmd='cd frontend && yarn dev',
  deps=['frontend/src'],
  resource_deps=['frontend-install'],
  readiness_probe=probe(
    period_secs=5,
    http_get=http_get_action(port=5173, path='/'),
  ),
  labels=['frontend'],
  links=[link('http://localhost:5173', 'Relay UI')]
)

print("Relay Frontend: http://localhost:5173")
print("Relay Backend:  http://localhost:3000")
print("GraphQL:        http://localhost:3000/graphql")

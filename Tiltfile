# Relay Tiltfile
# Orchestrates the local development environment (backend + frontend + Postgres).

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

local_resource(
  'validate-db',
  cmd='./scripts/validate-db.sh',
  deps=['scripts/validate-db.sh'],
  labels=['setup']
)

local_resource(
  'frontend',
  cmd='echo "Starting frontend"',
  serve_cmd='cd frontend && yarn dev',
  deps=['frontend/src'],
  resource_deps=['frontend-install'],
  labels=['frontend'],
  links=[link('http://localhost:5173', 'Relay UI')]
)

local_resource(
  'backend',
  cmd='echo "Starting backend"',
  serve_cmd='cd backend && yarn start:dev',
  deps=['backend/src'],
  ignore=['backend/src/schema.gql'],
  resource_deps=['backend-install', 'validate-db'],
  trigger_mode=TRIGGER_MODE_MANUAL,
  auto_init=True,
  labels=['backend'],
  links=[
    link('http://localhost:3000', 'Backend API'),
    link('http://localhost:3000/graphql', 'GraphQL Playground')
  ]
)

print("Relay Frontend: http://localhost:5173")
print("Relay Backend: http://localhost:3000")
print("Relay GraphQL Playground: http://localhost:3000/graphql")

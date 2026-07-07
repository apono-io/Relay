FROM node:20-alpine AS build

WORKDIR /app

COPY package.json yarn.lock ./
COPY backend/package.json ./backend/
COPY backend/ ./backend/

RUN yarn install --frozen-lockfile
RUN yarn workspace backend build

FROM node:20-alpine

WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/backend/package.json ./backend/
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules

EXPOSE 3000
CMD ["node", "backend/dist/src/main.js"]

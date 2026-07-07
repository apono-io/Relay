FROM node:20-alpine AS build

WORKDIR /app

COPY package.json yarn.lock ./
COPY frontend/package.json ./frontend/
COPY frontend/ ./frontend/

RUN yarn install --frozen-lockfile

ARG VITE_API_URL="http://localhost:3000"
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app/frontend
RUN yarn vite build

FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

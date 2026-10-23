FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --legacy-peer-deps

COPY socket-server/package.json socket-server/package-lock.json ./socket-server/
RUN npm ci --prefix socket-server

COPY db ./db
COPY src ./src
COPY socket-server/tsconfig.json ./socket-server/
COPY socket-server/src ./socket-server/src
RUN npm run build --prefix socket-server

FROM node:24-bookworm-slim

WORKDIR /app

COPY --from=build /app/socket-server/dist ./dist

EXPOSE 3001

CMD ["node", "dist/index.cjs"]

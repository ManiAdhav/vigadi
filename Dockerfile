FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

# Railway sets NODE_ENV=production globally — force devDependencies for the build step
ENV NODE_ENV=development
RUN npm ci

COPY . .

RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=3000

RUN mkdir -p /app/data

EXPOSE 3000

VOLUME ["/app/data"]

CMD ["node", "dist/server.cjs"]

FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Vite embeds VITE_* values at build time, so Docker builds must expose them
# before running `npm run build`.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
# Воронка для входа без параметров. Необязательна: без неё берётся значение по
# умолчанию, зашитое в src/components/webapp/twa.ts.
ARG VITE_DEFAULT_FUNNEL_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_DEFAULT_FUNNEL_ID=$VITE_DEFAULT_FUNNEL_ID

RUN test -n "$VITE_SUPABASE_URL" \
  && test -n "$VITE_SUPABASE_ANON_KEY" \
  && npm run build

FROM node:20-slim AS runtime

WORKDIR /app

# Required only at runtime for Telegram video notes.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server.ts ./server.ts
COPY --chown=node:node server ./server
COPY --chown=node:node shared ./shared

# Create data directory for images
RUN mkdir -p data/images data/media && chown -R node:node /app/data

# Set production mode
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

USER node

# Start server
CMD ["node", "--import", "tsx/esm", "server.ts"]

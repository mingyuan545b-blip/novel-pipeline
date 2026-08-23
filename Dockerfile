FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY client/package*.json ./client/
RUN cd client && npm ci

COPY . .
RUN cd client && npm run build

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/client/dist ./client/dist
COPY server ./server
COPY scripts ./scripts
COPY .env.example ./.env.example

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/index.js"]

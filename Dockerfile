FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production=false

COPY . .

RUN npx vite build
RUN npx tsc -p tsconfig.server.json

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/server/index.js"]

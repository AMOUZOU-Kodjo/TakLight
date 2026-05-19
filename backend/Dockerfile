FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .

RUN npx prisma generate

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && pnpm dev"]

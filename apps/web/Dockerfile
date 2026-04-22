FROM node:20-alpine
WORKDIR /app

# Prisma requires openssl
RUN apk add --no-cache openssl

COPY package*.json .npmrc ./
RUN npm ci

COPY . .
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate

EXPOSE 3000
CMD ["npm", "run", "dev"]

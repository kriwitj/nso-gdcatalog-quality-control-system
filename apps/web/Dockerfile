FROM node:20-alpine
WORKDIR /app

# Prisma requires openssl
RUN apk add --no-cache openssl

COPY package.json ./
RUN npm install

COPY . .
RUN npx prisma generate

EXPOSE 3000
CMD ["npm", "run", "dev"]

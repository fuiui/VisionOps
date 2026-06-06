FROM node:22-alpine

WORKDIR /app

COPY frontend/package.json /app/package.json
COPY frontend/tsconfig.json /app/tsconfig.json
COPY frontend/vite.config.ts /app/vite.config.ts
COPY frontend/index.html /app/index.html
RUN npm install

COPY frontend/src /app/src

EXPOSE 3000

CMD ["npm", "run", "dev"]


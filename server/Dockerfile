
FROM mcr.microsoft.com/playwright:v1.64.1-noble

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV NODE_ENV=production

RUN apt-get update \
    && apt-get install -y xvfb \
    && rm -rf /var/lib/apt/lists/*

CMD ["xvfb-run", "-a", "npm", "start"]

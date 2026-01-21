FROM node:20-slim

# 👇 AQUI É ONDE ENTRA ESSE BLOCO
RUN apt-get update && apt-get install -y \
  poppler-utils \
  tesseract-ocr \
  tesseract-ocr-por \
  imagemagick \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server.cjs"]

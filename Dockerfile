FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json (если есть)
COPY package*.json ./   

# Устанавливаем зависимости
RUN npm install -g ts-node && npm install 

# Копируем все файлы проекта
COPY . .

# Открываем нужный порт (если бот использует веб-сервер)
EXPOSE 4000

# Команда для запуска бота
CMD ["npm", "run", "start"]
const { Telegraf } = require("telegraf");

const token = "7575965565:AAH4HeABBMFLTDK6f2mRjXuRwGc_PrB3DZo";
const bot = new Telegraf(token);

const activeTimers = {};
const SEND_INTERVAL = 43 * 60 * 1000;

// Укажите username канала
const channelChatId = "@https://t.me/rocketgamesbet"; // Ваш канал

const namesMocks = [
  "M",
  "Матвей",
  "Hex the Sun",
  "Ilya",
  "Flanyaaa",
  "Lizza",
  "vb",
  "LelLel",
  "crippleo",
  "Максим",
  "Sergey",
  "MDG",
  "Dim4ik",
  "s1mple",
  "hypiXelSanya",
  "Morris",
  "блаблабле",
  "почему?",
  "тайлер",
  "морган",
  "вадим",
  "декстер",
  "фимк1",
  "Vladik69",
  "VM",
  "Artem",
  "San4oyHex",
  "СФ",
  "VikaToriaaa",
];

const prices = [
  "0.14",
  "0.25",
  "0,33",
  "0.506",
  "5",
  "1",
  "1.45",
  "2",
  "3",
  "0.5",
  "3.3",
  "4.21",
  "6.85",
  "1.98",
  "2.5",
];

const games = ["🎲 Кубики", "💣 Мины"];

function escapeMarkdownV2(text) {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

function generateRandomMessage() {
  const randomName = escapeMarkdownV2(
    namesMocks[Math.floor(Math.random() * namesMocks.length)]
  );
  const randomPrice = escapeMarkdownV2(
    prices[Math.floor(Math.random() * prices.length)]
  );
  const randomGame = escapeMarkdownV2(
    games[Math.floor(Math.random() * games.length)]
  );
  const winChance = Math.random() * 100; // Рандомный шанс выигрыша

  const result = winChance < 69 ? "✅ Выграл" : "🟥 Проиграл"; // Если шанс больше 69%, то выиграл

  // Формируем строку
  const message = `
💎 **${randomName}**
💸Сделал ставку: **${randomPrice} USDT** 
  
🎮Режим: ${randomGame}

${result}
[Сделать ставку\\!](https://t.me/games_rocket_bot)
`;

  return message;
}

// Команда для старта сообщений
bot.command("startSend", (ctx) => {
  if (activeTimers[channelChatId]) {
    return ctx.reply("⏳ Уже отправляю сообщения...");
  }

  ctx.reply("🚀 Начинаю спамить Привет!");

  // Запускаем таймер
  activeTimers[channelChatId] = setInterval(() => {
    bot.telegram.sendMessage(channelChatId, generateRandomMessage(), {
      parse_mode: "MarkdownV2",
    });
  }, SEND_INTERVAL);
});

// Команда для остановки
bot.command("stopSend", (ctx) => {
  if (!activeTimers[channelChatId]) {
    return ctx.reply("⛔️ Я и так молчу...");
  }

  clearInterval(activeTimers[channelChatId]);
  delete activeTimers[channelChatId];

  ctx.reply("🛑 Остановил спам!");
});

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error(`Ошибка для ${ctx.updateType}:`, err);
  ctx.reply(
    "Произошла ошибка. Попробуйте снова, введите команду /start или обратитесь в поддержку."
  );
});

// Запуск бота
bot
  .launch()
  .then(() => {
    console.log("🤖 Бот запущен! :))");
  })
  .catch((err) => {
    console.error("Ошибка при запуске бота:", err);
  });

import { Pool } from "pg";
import { Context, Markup, Telegraf } from "telegraf";
const token = "7622229101:AAELYXDJvJfAHkF9IuTx4IpNcZqvOe2VrU8";
const bot = new Telegraf(token);
const express = require("express"); // Для создания веб-сервера
const app = express();

// const pool = new Pool({
//   user: "postgres",
//   host: "localhost",
//   database: "casino-rocket-test",
//   password: "root",
//   port: 5432,
// });
const pool = new Pool({
  user: "postgres",
  host: "db",
  database: "casino-rocket",
  password: "root",
  port: 5432,
});

//
// INIT DB
//
app.use(express.json());

enum Actions {
  UsersControl = "users_control",
  PaymentsControl = "payments_control",
  ReferalsControl = "referals_control",
  GamesControl = "games_control",
  BackToMainMenu = "back_to_main_menu",
  AllUsers = "all_users",
}
enum NavStates {
  UsersControl = "users_control",
  PaymentsControl = "payments_control",
  ReferalsControl = "referals_control",
  GamesControl = "games_control",
  MainMenu = "back_to_main_menu",
  AllUsers = "all_users",
}

let currentNavState = NavStates.MainMenu;

// FUNCS GEN MENUS
function mainMenu() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "🧑‍🤝‍🧑 Управление пользователями",
        Actions.UsersControl
      ),
    ],
    [
      Markup.button.callback(
        "💳 Управление средствами",
        Actions.PaymentsControl
      ),
      Markup.button.callback(
        "💸 Управление рефералами",
        Actions.ReferalsControl
      ),
    ],
    [Markup.button.callback("🎮 Управление играми", Actions.GamesControl)],
  ]);
}

//

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  if (userId === 1217209518) {
    ctx.reply(`🚀 Админ панель 🚀`, mainMenu());
  }
});

bot.action(Actions.UsersControl, async (ctx) => {
  currentNavState = NavStates.UsersControl;
  ctx.editMessageText(
    `🧑‍🤝‍🧑 Управление пользователями`,
    Markup.inlineKeyboard([
      [Markup.button.callback("🧘 Все пользователи", Actions.AllUsers)],
      [
        Markup.button.callback(
          "🧘📅 Пользователи созданные сегодня",
          Actions.AllUsers
        ),
      ],
      [Markup.button.callback("🔙 Назад", Actions.BackToMainMenu)],
    ])
  );
});

bot.action(Actions.AllUsers, async (ctx) => {
  currentNavState = NavStates.AllUsers;
  const users = await pool.query(
    "SELECT * FROM users WHERE created_at >= NOW() - INTERVAL '1 day'"
  );
  ctx.editMessageText(
    `🧘 Все пользователи\n\n` +
      users.rows
        .map(
          (user) =>
            `ID: ${user.id}, Ник: ${user.username}, Баланс: ${
              user.balance
            }, Дата создания: ${user.created_at}, Приглашен: ${
              user?.refferal.id ? user?.refferal.id : "Нет"
            }`
        )
        .join("\n")
  ),
    Markup.inlineKeyboard([
      [Markup.button.callback("🔙 Назад", Actions.UsersControl)],
    ]);
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на по))ту ${PORT}`);
});

bot.catch((err, ctx) => {
  console.error(`Ошибка для ${ctx.updateType}:`, err);
  ctx.reply(
    "Произошла ошибка. Попробуйте снова, введите команду /start или обратитесь в поддержку."
  );
});

bot
  .launch()
  .then(() => {
    console.log("🤖 Admin Бот запущен! :))");
  })
  .catch((err) => {
    console.error("Ошибка при запуске бота:", err);
  });

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
  TodayUsers = "today_users",
  ChangeUserBalance = "change_user_balance",
  ChangeUserBalanceConfirm = "change_user_balance_confirm",
  ChangeUserBalanceAmmount = "change_user_balance_ammount",
}
enum NavStates {
  UsersControl = "users_control",
  PaymentsControl = "payments_control",
  ReferalsControl = "referals_control",
  GamesControl = "games_control",
  MainMenu = "back_to_main_menu",
  AllUsers = "all_users",
  TodayUsers = "today_users",
  ChangeUserBalance = "change_user_balance",
  ChangeUserBalanceConfirm = "change_user_balance_confirm",
  ChangeUserBalanceAmmount = "change_user_balance_ammount",
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
          Actions.TodayUsers
        ),
      ],
      [Markup.button.callback("💳 Изменить баланс", Actions.ChangeUserBalance)],
      [Markup.button.callback("🔙 Назад", Actions.BackToMainMenu)],
    ])
  );
});

bot.action(Actions.BackToMainMenu, async (ctx) => {
  currentNavState = NavStates.MainMenu;
  ctx.editMessageText(`🚀 Админ панель 🚀`, mainMenu());
});

bot.action(Actions.TodayUsers, async (ctx) => {
  currentNavState = NavStates.TodayUsers;
  const users = await pool.query(
    "SELECT * FROM users WHERE created_at >= NOW() - INTERVAL '1 day'"
  );

  ctx.editMessageText(
    `🧘📅 *Пользователи за сегодня*\n\n` +
      users.rows
        .map((user) => {
          // Форматируем дату
          const formattedDate = new Date(user.created_at).toLocaleString(
            "en-US",
            {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }
          );

          return (
            `*ID:* ${user?.user_id}\n` +
            `*Баланс:* ${user.balance} USDT\n` +
            `*Дата создания:* ${formattedDate}\n` +
            `*Приглашен:* ${user?.referrer_id ? user?.refferal.id : "Нет"}\n` +
            `\n━━━━━━━━━━━━━━━━━━\n`
          );
        })
        .join("\n"),
    {
      parse_mode: "Markdown", // Указываем, что используем Markdown
      reply_markup: {
        inline_keyboard: [
          [Markup.button.callback("🔙 Назад", Actions.UsersControl)],
        ],
      },
    }
  );
});

bot.action(Actions.AllUsers, async (ctx) => {
  currentNavState = NavStates.AllUsers;
  const users = await pool.query("SELECT * FROM users");

  const userMessages = await Promise.all(
    users.rows.map(async (user) => {
      const formattedDate = new Date(user.created_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const depositsRes = await pool.query(
        "SELECT * FROM deposits WHERE user_id = $1",
        [user.user_id]
      );
      const withdrawsRes = await pool.query(
        "SELECT * FROM withdraws WHERE user_id = $1",
        [user.user_id]
      );

      const deposits = depositsRes.rows;
      const withdraws = withdrawsRes.rows;

      const totalDeposits = deposits.reduce(
        (sum, d) => sum + Number(d.amount || 0),
        0
      );
      const totalWithdraws = withdraws.reduce(
        (sum, w) => sum + Number(w.sum || 0),
        0
      );
      const ratio = totalDeposits - totalWithdraws;

      return (
        `*ID:* ${user?.user_id}\n` +
        `*Баланс:* ${user.balance} USDT\n` +
        `*Дата создания:* ${formattedDate}\n` +
        `*Приглашен:* ${user?.referrer_id ? user?.referrer_id : "Нет"}\n\n` +
        `*Соотношение:* ${ratio} USDT\n`
      );
    })
  );

  ctx.editMessageText(`🧘 *Все пользователи*\n\n${userMessages.join("")}`, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [Markup.button.callback("🔙 Назад", Actions.UsersControl)],
      ],
    },
  });
});

bot.action(Actions.ChangeUserBalance, async (ctx) => {
  currentNavState = NavStates.ChangeUserBalance;
  ctx.editMessageText(
    "Введите ID пользователя",
    Markup.inlineKeyboard([
      Markup.button.callback("🔙 Назад", Actions.UsersControl),
    ])
  );
});

//MAKE HERE
bot.hears(/^\d+$/, async (ctx) => {
  const userId = Number(ctx.match[0]);
  const user = await pool.query("SELECT * FROM users WHERE user_id = $1", [
    userId,
  ]);
  if (currentNavState === NavStates.ChangeUserBalanceAmmount) {
    const amount = ctx.match[0];
    const user = await pool.query("SELECT * FROM users WHERE user_id = $1", [
      userId,
    ]);
    if (user.rows.length === 0) {
      return ctx.reply("Пользователь не найден", {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback("🔙 Назад", Actions.UsersControl)],
          ],
        },
      });
    }
    const userBalance = user.rows[0].balance;
    const newBalance = userBalance + Number(amount);
    await pool.query("UPDATE users SET balance = $1 WHERE user_id = $2", [
      newBalance,
      userId,
    ]);
    ctx.reply(
      `Баланс пользователя ${userId} изменен на ${newBalance} USDT`,
      Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Назад", Actions.UsersControl)],
      ])
    );
  }
  if (user.rows.length === 0) {
    return ctx.reply("Пользователь не найден", {
      reply_markup: {
        inline_keyboard: [
          [Markup.button.callback("🔙 Назад", Actions.UsersControl)],
        ],
      },
    });
  }

  ctx.editMessageText(
    `*ID:* ${userId}\n` +
      `*Баланс:* ${user.rows[0].balance} USDT\n\n` +
      {
        reply_markup: {
          inline_keyboard: [
            [
              Markup.button.callback(
                "💲 Изменить баланс",
                Actions.ChangeUserBalanceAmmount
              ),
            ],
            [Markup.button.callback("🔙 Назад", Actions.UsersControl)],
          ],
        },
      }
  );

  currentNavState = NavStates.ChangeUserBalanceConfirm;
});

bot.action(Actions.ChangeUserBalanceAmmount, async (ctx) => {
  currentNavState = NavStates.ChangeUserBalanceAmmount;
  ctx.editMessageText(
    "Введите сумму для изменения баланса",
    Markup.inlineKeyboard([
      [Markup.button.callback("🔙 Назад", Actions.UsersControl)],
    ])
  );
});
// Markup.inlineKeyboard([
//   [Markup.button.callback("🔙 Назад", Actions.UsersControl)],
// ]);

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
    console.log("🤖 Admin Бот запущен! :)");
  })
  .catch((err) => {
    console.error("Ошибка при запуске бота:", err);
  });

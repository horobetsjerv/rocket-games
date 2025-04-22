import { Pool } from "pg";
const CryptoBotAPI = require("crypto-bot-api");
import axios from "axios";
import { Context, Markup, Telegraf } from "telegraf";
// const token  TEST = "7509717750:AAG5oqYmwZfpcLylA17p3sL8LlowYblYe4s";
const token = "7373612386:AAH-v0u6ikMxnqGDlCXLufszU0PFT-r6Stg";
const bot = new Telegraf(token);
const cryptoPayToken = "359650:AAdsPFXPTA5b58WFzQAAHkDBHXuLMOomywO";
const cryptoPayApiUrl = "https://pay.crypt.bot/api";
const cryptoClient = new CryptoBotAPI(cryptoPayToken); // Инициализация клиента
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

async function initDatabase() {
  const maxRetries = 10;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await pool.query("SELECT 1"); // Простой запрос для проверки соединения
      console.log("Подключение к базе данных установлено");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          user_id BIGINT PRIMARY KEY,
          selected_mines_count VARCHAR(10) DEFAULT '3',
          nav_state VARCHAR(50) DEFAULT 'mainMenu',
          bet NUMERIC(10, 2) DEFAULT 0.0,
          selected_dice_type VARCHAR(10) DEFAULT 'even',
          balance NUMERIC(10, 2) DEFAULT 0.00,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        
      `);
      console.log("Таблица 'users' успешно создана или уже существует");

      await pool.query(`
  ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referrer_id BIGINT,
  ADD COLUMN IF NOT EXISTS referral_link VARCHAR(100) UNIQUE;
      `);

      console.log("Поля для реферальной системы добавлены или уже существуют");

      await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS refprocent BIGINT DEFAULT 10;
          `);

      console.log("Поля для реферальной системы добавлены или уже существуют");

      try {
        await pool.query(`
          ALTER TABLE users
          ADD CONSTRAINT fk_referrer
          FOREIGN KEY (referrer_id) REFERENCES users(user_id)
        `);
        console.log("Ограничение fk_referrer успешно добавлено");
      } catch (constraintErr: any) {
        if (constraintErr.code === "42710") {
          // Ошибка 42701: ограничение уже существует
          console.log("Ограничение fk_referrer уже существует, пропускаем");
        } else {
          throw constraintErr; // Пробрасываем другие ошибки
        }
      }

      await pool.query(`
        UPDATE users
        SET referral_link = 'https://t.me/games_rocket_bot?start=' || user_id
        WHERE referral_link IS NULL;
      `);

      try {
        await pool.query(`
        CREATE TABLE IF NOT EXISTS referrals (
          id SERIAL PRIMARY KEY,
          referral_link VARCHAR(100),
          bet NUMERIC(10, 2)
        )`);
        console.log("Таблица 'referrals' успешно создана или уже существует");
      } catch (err) {
        console.error(
          `Ошибка при создании таблицы referrals (попытка ${retries}/${maxRetries}):`,
          err
        );
      }

      // Создаем таблицу для хранения информации о реферальных ссылках

      //Таблица віводов
      try {
        await pool.query(`CREATE TABLE IF NOT EXISTS withdraws (
          id SERIAL PRIMARY KEY,
          user_id BIGINT REFERENCES users(user_id), 
          sum NUMERIC(10, 2),
          status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT NOW()
        )`);
      } catch (err) {
        console.error(
          `Ошибка при создании таблицы withdraws (попытка ${retries}/${maxRetries}):`,
          err
        );
      }

      // Таблица реферального баланса

      try {
        await pool.query(`CREATE TABLE IF NOT EXISTS ref_balances (
          id SERIAL PRIMARY KEY,
          user_id BIGINT REFERENCES users(user_id) UNIQUE,
          referral_link VARCHAR(100),
          balance NUMERIC(10, 2),
          created_at TIMESTAMP DEFAULT NOW()
        )`);
      } catch (err) {
        console.error(
          `Ошибка при создании таблицы ref_balances (попытка ${retries}/${maxRetries}):`,
          err
        );
      }

      // Таблица выводаъ реф

      try {
        await pool.query(`CREATE TABLE IF NOT EXISTS ref_withdraws (
          id SERIAL PRIMARY KEY,
          user_id BIGINT REFERENCES users(user_id),
          amount DECIMAL(12,2),
          status VARCHAR(20),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
          )`);
      } catch (err) {
        console.error(
          `Ошибка при создании таблицы ref_withdraws (попытка ${retries}/${maxRetries}):`,
          err
        );
      }

      // Таблица депозитов

      try {
        await pool.query(`CREATE TABLE IF NOT EXISTS deposits (
          id SERIAL PRIMARY KEY,
          user_id BIGINT REFERENCES users(user_id),
          amount DECIMAL(12, 2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
      } catch (err) {
        console.error(
          `Ошибка при создании таблицы deposits (попытка ${retries}/${maxRetries}):`,
          err
        );
      }

      break; // Выходим из цикла, если всё ок
    } catch (err) {
      retries++;
      console.error(
        `Ошибка подключения к базе данных (попытка ${retries}/${maxRetries}):`,
        err
      );
      if (retries === maxRetries) {
        throw new Error(
          "Не удалось подключиться к базе данных после всех попыток"
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Ждём 2 секунды перед повторной попыткой
    }
  }
}

// Выполняем инициализацию базы данных при старте
initDatabase();

export const query = (text: string, params?: any[]) => pool.query(text, params);

export default pool;

app.use(express.json());
const ROWS = 5;
const COLS = 5;
const HOUSE_EDGE = 0.2;
let i = 0;
// HERE START APP WORK STATES
const coefficients = {
  3: [
    1.07, 1.23, 1.41, 1.64, 1.91, 2.25, 2.67, 3.21, 3.9, 4.8, 6, 7.63, 9.93,
    13.24, 18.2, 26.01, 39.01, 62.42, 109.25, 218.5, 546.25, 2185,
  ],
  5: [
    1.18, 1.5, 1.91, 2.48, 3.25, 4.34, 5.89, 8.15, 11.55, 16.8, 25.21, 39.21,
    63.72, 109.24, 200.29, 400.58, 901.31, 2403.49, 8412.24, 50473.49,
  ],
  7: [
    1.31, 1.86, 2.67, 3.92, 5.89, 9.06, 14.34, 23.48, 39.91, 70.96, 133.06,
    266.12, 576.59, 1383.83, 3805.54, 12685.13, 57083.12, 456665,
  ],
  9: [
    1.48, 2.37, 3.9, 6.6, 11.55, 21, 39.91, 79.83, 169.65, 387.77, 969.44,
    2714.44, 8821.93, 35287.74, 194082.62, 1940826.24,
  ],
  12: [
    1.82, 3.65, 7.63, 16.8, 39.21, 98.04, 266.12, 798.36, 2714.44, 10857.76,
    54288.84, 380021.92, 4940284.99,
  ],
  17: [2.96, 10.17, 39.01, 171.67, 901.31, 6008.75, 57083.12, 1027496.25],
};

enum Actions {
  BACKTOMENU = "back_to_menu",
  CHANGEBET = "change_bet",
  MINESMENU = "mines_menu",
  DICEMENU = "dice_menu",
  DEPOSIT = "deposit",
  WITHDRAW = "withdraw",
  PLAY = "play",
  PROFILE = "profile",
  STARTTOPLAYMINES = "play_mines",
  CHANGEMINESCOUNT = "change_mines_count",
  BACKTOMINEMENU = "back_to_mines_menu",
  COLLECTWINMINESBOT = "collect_win",
  BACKTOGAMESMENU = "back_to_games_menu",
  EVENDICE = "even_dice",
  ODDDICE = "odd_dice",
  MOREDICE = "more_dice",
  LESSDICE = "less_dice",
  BACKTODICEMENU = "back_to_dice_menu",
  CRYPTOBOT = "crypto_bot",
  OPENPRICEMENUFORWITHDRAW = "open_price_menu_for_withdraw",
  GETDEPOSITAMOUNTMENU = "get_deposit_amount_menu",
  OPEN_ACTIVE_REFERALS = "open_active_referrals",
  REFFERAL_USER_MENU = "referal_user_menu",
  WITHDRAW_REFERALS_CASH = "withdraw_referals_cash",
}

enum NAVSTATES {
  MAINMENU = "mainMenu",
  PROFILEMENU = "profileMenu",
  GAMESMENU = "gamesMenu",
  MINESMENU = "minesMenu",
  DICEMENU = "diceMenu",
  MINESGAME = "minesGame",
  CHANGEMINESCOUNT = "changeMinesCount",
  COLLECTEDCASH = "collectedCash",
  DICEGAME = "diceGame",
  DEPOSIT = "deposit",
  WITHDRAW = "withdraw",
  CHANGEBET = "changeBet",
  OPENPRICEMENUFORWITHDRAW = "openPriceMenuForWithdraw",
  REFFERAL_USER_MENU = "referal_user_menu",
  OPEN_ACTIVE_REFERALS = "open_active_referrals",
  GETDEPOSITAMOUNTMENU = "get_deposit_amount_menu",
  WITHDRAW_REFERALS_CASH = "withdraw_referals_cash",
}

enum GAMES {
  MINES = "mines",
  DICE = "dice",
}

enum DICEGAMETYPES {
  EVEN = "even",
  ODD = "odd",
  MORE = "more",
  LESS = "less",
}

const clickedCells = new Map<string, string>();

// 📌 1️⃣ Создаём класс для хранения данных каждого пользователя

function createKeyboard(winBet: number) {
  // Создаем кнопки для игрового поля
  const fieldButtons = Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col) =>
      Markup.button.callback("⬜", `cell_${row}_${col}`)
    )
  );

  // Создаем кнопку "Забрать выигрыш"
  const collectButton = [
    Markup.button.callback(`Забрать выигрыш ${winBet} USDT`, "collect_win"),
  ];

  // Объединяем кнопки игрового поля и кнопку "Забрать выигрыш"
  return Markup.inlineKeyboard([...fieldButtons, collectButton]);
}

class GameSession {
  user: any;
  gameName: GAMES;
  constructor(user: any, gameName: GAMES) {
    this.user = user;
    this.gameName = gameName;
  }

  startGame(ctx: Context) {
    if (this.gameName === GAMES.MINES) {
      const game = new MineGameSession(
        this.user,
        this.user.selectedMinesCount,
        this.user.bet
      );

      this.user.currentGame = game;
      game.startGame(ctx);
    }
    if (this.gameName === GAMES.DICE) {
      const game = new DiceGameSession(this.user, this.user.selectedDiceType);

      this.user.currentGame = game;
      game.startGame(ctx);
    }
  }
}

class DiceGameSession {
  user: any;
  gameType: DICEGAMETYPES;
  constructor(user: any, gameType: DICEGAMETYPES) {
    this.user = user;
    this.gameType = gameType;
  }
  startGame(ctx: Context) {
    console.log(this.gameType);
    this.user.updateBalance(-this.user.bet);
    if (this.gameType === DICEGAMETYPES.EVEN) {
      const win = Math.random() < 0.4;
      if (win) {
        this.user.updateBalance(this.user.bet * 1.8);
        ctx.editMessageText(
          `Выпало чётное число, игра окончена. \nВаш выигрыш ${
            this.user.bet * 1.8
          } USDT 🎉`,

          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "Вернуться к играм",
                Actions.BACKTOGAMESMENU
              ),
            ],
          ])
        );
      }
      if (!win) {
        ctx.editMessageText(
          `К сожалению выпало нечётное число, вы проиграли 😞`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "Вернуться к играм",
                Actions.BACKTOGAMESMENU
              ),
            ],
          ])
        );
      }
    }
    if (this.gameType === DICEGAMETYPES.ODD) {
      const win = Math.random() < 0.4; // шанс на війграш
      if (win) {
        this.user.updateBalance(this.user.bet * 1.8);
        ctx.editMessageText(
          `Выпало нечётное число, игра окончена. \nВаш выигрыш ${
            this.user.bet * 1.8
          } USDT 🎉`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "Вернуться к играм",
                Actions.BACKTOGAMESMENU
              ),
            ],
          ])
        );
      }
      if (!win) {
        ctx.editMessageText(
          `К сожалению выпало четное число, вы проиграли 😞`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "Вернуться к играм",
                Actions.BACKTOGAMESMENU
              ),
            ],
          ])
        );
      }
    }
    if (this.gameType === DICEGAMETYPES.MORE) {
      const win = Math.random() < 0.4;
      if (win) {
        this.user.updateBalance(this.user.bet * 1.8);

        ctx.editMessageText(
          `
        Выпало больше, игра окончена. \n Ваш выигрыш ${
          this.user.bet * 1.8
        } USDT 🎉`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "Вернуться к играм",
                Actions.BACKTOGAMESMENU
              ),
            ],
          ])
        );
      }
      if (!win) {
        ctx.editMessageText(
          `К сожалению выпало меньше, вы проиграли 😞`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "Вернуться к играм",
                Actions.BACKTOGAMESMENU
              ),
            ],
          ])
        );
      }
    }
    if (this.gameType === DICEGAMETYPES.LESS) {
    }
  }
}

class MineGameSession {
  user: any;
  selectedMinesCount: "3" | "5" | "7" | "9" | "12" | "17";
  bet: number;
  nextWin: number;
  revealedCells: Map<string, string>; // Открытые клетки и их иконки
  constructor(
    user: any,
    selectedMinesCount: "3" | "5" | "7" | "9" | "12" | "17",
    bet: number
  ) {
    this.user = user;
    this.selectedMinesCount = selectedMinesCount;
    this.bet = bet;
    this.nextWin = 0;
    this.revealedCells = new Map();
  }

  getMineProbability(): number {
    console.log(this.revealedCells);
    const totalCells = ROWS * COLS;
    const openedCells = this.revealedCells.size;
    const minesCount = parseInt(this.selectedMinesCount, 10);
    const remainingCells = totalCells - openedCells;
    const remainingMines = minesCount - this.revealedCells.size; // Предполагается, что revealedCells хранит уже открытые минные ячейки
    const startLoseVariant =
      minesCount === 3
        ? 0.35
        : minesCount === 5
        ? 0.4
        : minesCount === 7
        ? 0.45
        : minesCount === 9
        ? 0.5
        : minesCount === 12
        ? 0.6
        : minesCount === 17
        ? 0.7
        : 0.7;
    // Определяем, как быстро увеличивается шанс (каждое открытие увеличивает на 0.5%)
    const increasePerOpen = 0.05; // 0.5% за открытие

    // Шанс увеличивается с каждым открытием
    let probabilityIncrease = openedCells * increasePerOpen;

    // Убедимся, что шанс не превышает 100% и учитываем "хауседжи"
    let totalProbability = startLoseVariant + probabilityIncrease;

    // Если осталось ячеек столько же, сколько мин (плюс 1), шанс должен быть 100%
    if (remainingCells <= remainingMines + 1) {
      totalProbability = 1;
    }

    // Возвращаем итоговый шанс, ограничив его от 0 до 1
    return Math.min(totalProbability, 1);
  }

  getNextCoef() {
    const totalCells = ROWS * COLS;
    const openedCells = this.revealedCells.size;
    const minesCount = parseInt(this.selectedMinesCount, 10);

    const coefs = coefficients[minesCount as 3 | 5 | 7 | 9 | 12 | 17] || [];
    const coeficient = coefs[openedCells];
    console.log(coeficient);
    return coeficient;
  }

  getWinCash() {
    const openedCells = this.revealedCells.size;
    const minesCount = parseInt(this.selectedMinesCount, 10);

    const coefs = coefficients[minesCount as 3 | 5 | 7 | 9 | 12 | 17] || [];
    const coeficient = coefs[openedCells - 1] || 1;
    return this.bet * coeficient;
  }

  collectWinCash(ctx: Context, user: any) {
    const cash = this.getWinCash();
    const newCash = cash - user.bet;
    user.updateBalance(newCash);
    console.log(newCash);
    return ctx.editMessageText(
      `🎉 Победа! Вы выиграли ${cash.toFixed(
        2
      )} USDT\n 💸 Выигрыш начислен в ваш баланс
`,
      Markup.inlineKeyboard([
        [Markup.button.callback("Вернуться к играм", Actions.BACKTOGAMESMENU)],
      ])
    );
  }

  handleCellClick(
    row: number,
    col: number
  ): { isMine: boolean; newIcon: string } {
    const cellId = `${row}_${col}`;
    console.log(this.getNextCoef());
    if (this.revealedCells.has(cellId)) {
      return { isMine: false, newIcon: this.revealedCells.get(cellId)! };
    }

    const isMine = Math.random() < this.getMineProbability();
    console.log(this.getMineProbability());
    const newIcon = isMine ? "💣" : "✅";

    // Сохраняем результат нажатия
    this.revealedCells.set(cellId, newIcon);

    return { isMine, newIcon };
  }

  getUpdatedKeyboard() {
    // Создаем кнопки для игрового поля
    const fieldButtons = Array.from({ length: ROWS }, (_, row) =>
      Array.from({ length: COLS }, (_, col) => {
        const cellId = `${row}_${col}`;
        const icon = this.revealedCells.get(cellId) || "⬜"; // Если клетка не открыта, показываем "⬜"
        return Markup.button.callback(icon, `cell_${row}_${col}`);
      })
    );

    // Создаем кнопку "Забрать выигрыш"
    const collectButton = [
      Markup.button.callback(
        `Забрать выигрыш ${this.getWinCash().toFixed(2)} USDT`,
        "collect_win"
      ),
    ];

    // Объединяем кнопки игрового поля и кнопку "Забрать выигрыш"
    return Markup.inlineKeyboard([...fieldButtons, collectButton]);
  }

  startGame(ctx: Context) {
    ctx.editMessageText(
      `💣 Мины · ${this.selectedMinesCount} \n 💰 Выигрыш · ${
        this.bet
      } → ${this.getWinCash()} USDT \n 📊 Следующий коэффициент · ${this.getNextCoef()} `,
      createKeyboard(this.bet)
    );
  }
}

class Refferal {
  referral_link: string;
  bet: number;
  constructor(userId: string, bet: number) {
    this.referral_link = `https://t.me/games_rocket_bot?start=${userId}`;
    this.bet = bet;
  }

  async save() {
    try {
      await query(
        `
      INSERT INTO referrals 
        (referral_link, bet)
      VALUES ($1, $2)
      RETURNING *;
          `,
        [this.referral_link, this.bet]
      );
      console.log("Сохранен успешно");
    } catch (err) {
      console.error("Ошибка сохранения пользователя:", err);
    }
  }
  /// ADD REFERRAL DEPOSIT TO REF_BALANCES
  async addRefferDeposit(amount: number, userId: string) {
    try {
      await query(
        `
      INSERT INTO ref_balances 
        (user_id, referral_link, balance)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE SET
        balance = ref_balances.balance + $3
          `,
        [userId, this.referral_link, amount]
      );
      console.log("Сохранен успешно");
    } catch (error) {
      console.error("Ошибка добавления депозита в реферальный баланс:", error);
    }
    console.log("userId in Method", userId);
    const userIdToString = userId.toString();
    const referral = new Refferal(userIdToString, amount);
    await referral.save();
  }
}

class UserSession {
  userId: any;
  selectedMinesCount: string;
  navstate: string;
  bet: number;
  currentGame: GameSession | null;
  selectedDiceType: DICEGAMETYPES;
  balance: number;
  depositAmount: number | null;
  referral_link: string;
  referrer_id: any;
  refprocent: number;
  constructor(userId: any, referrer_id: any) {
    this.userId = userId;
    this.depositAmount = 0;
    this.selectedMinesCount = "3"; // Значение по умолчанию
    this.navstate = NAVSTATES.MAINMENU;
    this.selectedDiceType = DICEGAMETYPES.EVEN;
    this.bet = 0;
    this.balance = 0;
    this.currentGame = null;
    this.referral_link = `https://t.me/games_rocket_bot?start=${userId}
 `;
    this.refprocent = 10;
    this.referrer_id = referrer_id;
  }

  async load() {
    try {
      const res = await query("SELECT * FROM users WHERE user_id = $1", [
        this.userId,
      ]);
      if (res.rows.length > 0) {
        const data = res.rows[0];
        this.selectedMinesCount = data.selected_mines_count || "3";
        this.navstate = data.nav_state || NAVSTATES.MAINMENU; // Если в БД нет, используем MAINMENU
        this.bet = parseFloat(data.bet) || 0;
        this.selectedDiceType =
          (data.selected_dice_type as DICEGAMETYPES) || DICEGAMETYPES.EVEN;
        this.balance = parseFloat(data.balance) || 0;
        this.referrer_id = data.referrer_id;
        this.referral_link = data.referral_link;
      } else {
        // Если пользователя нет в БД, сохраняем с дефолтными значениями
        await this.save();
      }
    } catch (err) {
      console.error("Ошибка загрузки пользователя:", err);
    }
  }

  async save() {
    console.log("userrId", this.userId);
    console.log(typeof this.userId);
    const safeReferrerId = this.referrer_id === "" ? null : this.referrer_id;
    try {
      await query(
        `
        INSERT INTO users 
          (user_id, selected_mines_count, nav_state, bet, selected_dice_type, balance, refprocent)
        VALUES ($1, $2, $3, $4, $5, $6, $9)
        ON CONFLICT (user_id) DO UPDATE SET
          selected_mines_count = $2,
          nav_state = $3,
          bet = $4,
          selected_dice_type = $5,
          balance = $6,
          referral_link = $7,
          referrer_id = $8,
          refprocent = $9,
          updated_at = NOW()
          
      `,
        [
          this.userId,
          this.selectedMinesCount,
          this.navstate,
          this.bet,
          this.selectedDiceType,
          this.balance,
          this.referral_link,
          safeReferrerId,
          this.refprocent,
        ]
      );
      console.log("Сохранен успешно");
    } catch (err) {
      console.error("Ошибка сохранения пользователя:", err);
    }
  }

  async setBet(newBet: number) {
    this.bet = newBet;
    await this.save();
  }

  async updateBalance(amount: number) {
    this.balance += amount;
    await this.save();
  }

  async updateRefferalBalance(amount: number) {
    console.log(this.referral_link);
    try {
      await query(`UPDATE referrals SET bet = 0 WHERE referral_link = $1;`, [
        this.referral_link,
      ]);
    } catch (err) {
      console.log(err);
    }
  }

  async withdrawFunds(ctx: Context, amount: string) {
    try {
      console.log("withdrawFunds: Входной amount:", typeof amount);

      // Проверяем, что amount — это число и не undefined

      // Проверяем минимальную сумму и баланс
      const NumberAmount = parseFloat(amount);
      console.log(NumberAmount);
      if (NumberAmount < 3) {
        throw new Error("Минимальная сумма вывода — 3 USDT"); // Исправлено с 3 на 0.01 для теста
      }
      if (NumberAmount > this.balance) {
        throw new Error("Недостаточно средств на балансе");
      }
      const newAmount = NumberAmount * 0.95;

      // SSS

      try {
        await query(
          `INSERT INTO  withdraws (user_id, sum)
          VALUES ($1, $2)
        `,
          [this.userId, newAmount]
        );
        console.log("Сохранен успешно");
        return ctx.reply(
          `✅Заявка на вывод была успешно отправлена!\n` +
            `Сумма: ${NumberAmount} USDT\n`,
          Markup.inlineKeyboard([
            [Markup.button.callback("⬅️ Назад", Actions.BACKTOMENU)],
          ])
        );
      } catch (err) {
        console.error("Ошибка вывода :", err);
      }

      // SSS

      // // Логируем перед вызовом transfer
      // console.log("withdrawFunds: amount перед transfer:", amount);
      // const newSpendId =
      //   Date.now().toString() + Math.random().toString(36).substring(2, 15);
      // // Создаём перевод через CryptoBotAPI
      // console.log(this.userId);
      // const objectTransfer = {
      //   userId: this.userId,
      //   asset: "USDT",
      //   amount: newAmount.toString(),
      //   spendId: newSpendId,
      // };
      // console.log(objectTransfer);
      // const transfer = await cryptoClient.transfer(objectTransfer);

      // // Уменьшаем баланс пользователя
      // await this.updateBalance(-NumberAmount);

      // // Отправляем сообщение об успешном выводе
      // await ctx.reply(
      //   `✅ Вывод успешно выполнен!\n` +
      //     `Сумма: ${NumberAmount} USDT\n` +
      //     `Новый баланс: ${this.balance.toFixed(2)} USDT\n` +
      //     `Средства отправлены через @CryptoBot.`,
      //   Markup.inlineKeyboard([
      //     [Markup.button.callback("⬅️ Назад", Actions.BACKTOMENU)],
      //   ])
      // );

      // return transfer;
    } catch (error: any) {
      console.error("Ошибка при выводе средств:", error);
      throw error;
    }
  }

  getUserProfile(ctx: Context, user: UserSession) {
    ctx.editMessageText(
      `🆔 Ваш ID: ${user.userId} \n🏦 Баланс: ${user.balance.toFixed(2)} USDT`,
      Markup.inlineKeyboard([
        [Markup.button.callback("⬅️ Назад", Actions.BACKTOMENU)],
      ])
    );
  }

  getWithdrawMenu(ctx: Context, user: UserSession) {
    ctx.editMessageText(
      "Выберите способ вывода",
      Markup.inlineKeyboard([
        [Markup.button.callback("CryptoBot", Actions.OPENPRICEMENUFORWITHDRAW)],
        [Markup.button.callback("⬅️ Назад", Actions.BACKTOMENU)],
      ])
    );
  }

  getOpenPriceMenuForWithdraw(ctx: Context, user: UserSession) {
    ctx.editMessageText(
      "Введите суму вывода в USDT (минимально 3 USDT) комисия 5%",
      Markup.inlineKeyboard([
        [Markup.button.callback("⬅️ Назад", Actions.BACKTOMENU)],
      ])
    );
  }

  async startWithdraw(ctx: Context, user: UserSession) {
    ctx.editMessageText("Вы поставили");
  }

  getDiceMenu(ctx: Context, user: UserSession) {
    ctx.editMessageText(
      `РЕЖИМ:🎲 Кубики

1) "🎲 Четное - 1.8x" - выигрыш при выпадении 2, 4, 6
2) "🎲 Нечетное - 1.8x" - выигрыш при выпадении 1, 3, 5

3) "🎲 Больше - 1.8x" - выигрыш при выпадении 4, 5, 6
4) "🎲 Меньше - 1.8x" - выигрыш при выпадении 1, 2, 3
`,

      Markup.inlineKeyboard([
        [
          Markup.button.callback("🎲 Четное  - 1.8x", Actions.EVENDICE),
          Markup.button.callback("🎲 Нечетное - 1.8x", Actions.ODDDICE),
        ],
        [
          Markup.button.callback("🎲 Больше - 1.8x", Actions.MOREDICE),
          Markup.button.callback("🎲 Меньше - 1.8x", Actions.LESSDICE),
        ],
        [Markup.button.callback("⬅️ Назад", Actions.BACKTOGAMESMENU)],
      ])
    );
  }

  getAmountOfDepositMenu(ctx: Context, user: UserSession) {
    ctx.editMessageText("Введите сумму пополнения мин (0.5 USDT)");
  }

  async createInvoice(user: UserSession) {
    const amount = user.depositAmount?.toString();
    const invoice = await cryptoClient.createInvoice({
      asset: "USDT",
      amount: amount,
      description: "Пополнение баланса в Casino Rocket",
      payload: JSON.stringify({ userId: this.userId }),
    });
    return invoice; // Возвращает объект с pay_url и другими данными
  }

  async OpenCryptoBot(ctx: Context, user: UserSession) {
    const invoice = await this.createInvoice(user);
    ctx.reply(
      "Оплата через: @CryptoBot \n \n👇 Нажмите ниже, чтобы пополнить баланс",
      {
        reply_markup: {
          inline_keyboard: [[{ text: "Оплатить", url: invoice.botPayUrl }]],
        },
      }
    );
  }

  async getDepositMenu(ctx: Context, user: UserSession) {
    ctx.reply(
      "💰 Выберите способ пополнения",
      Markup.inlineKeyboard([
        Markup.button.callback("Crypto bot", Actions.CRYPTOBOT),
      ])
    );
  }

  // Метод для обновления количества мин
  async setMinesCount(count: string) {
    this.selectedMinesCount = count;
    await this.save();
  }

  async getWithdrawReferalsMenu(ctx: Context, user: UserSession) {
    const res = await query(
      "SELECT * FROM referrals WHERE referral_link = $1",
      [user.referral_link]
    );
    const sum = res.rows.reduce((acc, row) => acc + parseFloat(row.bet), 0);
    const newSum = sum * user.refprocent;
    if (newSum <= 1) {
      await ctx.editMessageText(
        `Минимальная сумма вывода 1 USDT`,
        Markup.inlineKeyboard([
          [Markup.button.callback("⬅️ Назад", Actions.REFFERAL_USER_MENU)],
        ])
      );
      return;
    } else {
      await this.updateBalance(newSum);
      await this.updateRefferalBalance(newSum);
      await ctx.editMessageText(
        `Средства были успешно выведены на ваш счет`,
        Markup.inlineKeyboard([
          [Markup.button.callback("⬅️ В меню", Actions.BACKTOMENU)],
        ])
      );
    }
  }

  async getActiveRefferalUsers(user: UserSession) {
    const res = await query(
      "SELECT * FROM referrals WHERE referral_link = $1",
      [user.referral_link]
    );
    const sum = res.rows.reduce((acc, row) => acc + parseFloat(row.bet), 0);
    const newSum = sum * user.refprocent;
    console.log("userreflink", user.referral_link);
    console.log(res.rows);

    return newSum;
  }

  async getActiveRefferalUserMenu(ctx: Context, user: UserSession) {
    const referrals = await this.getActiveRefferalUsers(user);

    if (referrals <= 0) {
      await ctx.editMessageText(
        "У вас пока нет рефералов.",
        Markup.inlineKeyboard([
          [Markup.button.callback("⬅️ Назад", Actions.REFFERAL_USER_MENU)],
        ])
      );
      return;
    }

    // const list = referrals
    //   .map((r, i) => `${i + 1}. ${r.username ?? "Без имени"} (ID: ${r.id})`)
    //   .join("\n");

    // await ctx.editMessageText(`Ваши рефералы:\n\n${list}`);
    await ctx.editMessageText(
      `Ваши рефералы:
    
    💸 *Сумма рефералов:* \`${referrals} USDT\`
    `,
      {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("⬅️ Назад", Actions.REFFERAL_USER_MENU)],
          [
            Markup.button.callback(
              "💸 Вывести средства на счет",
              Actions.WITHDRAW_REFERALS_CASH
            ),
          ],
        ]).reply_markup,
      }
    );
  }

  async getRefferalUserMenu(ctx: Context, user: UserSession) {
    ctx.editMessageText(
      `Реферальная система
      
💰 Пригласите друзей и получайте % от их пополнений!
      
Ваш текущий процент = ${user.refprocent}%
📩 Отправьте свою реферальную ссылку друзьям:
https://t.me/${ctx.botInfo.username}?start=${user.userId}
      `,
      Markup.inlineKeyboard([
        [Markup.button.callback("⬅️ Назад", Actions.BACKTOMENU)],
        [
          Markup.button.callback(
            "Проверить рефералов",
            Actions.OPEN_ACTIVE_REFERALS
          ),
        ],
      ])
    );
  }

  // Метод для получения текущего меню "Мины"
  getMinesMenu(ctx: Context, user: UserSession) {
    ctx.editMessageText(
      `💥 Игра "Мины" 💥
      
💣 Выбрано ${user.selectedMinesCount} мины
🎯 Цель: Открывайте клетки, избегайте мин и забирайте свой выигрыш. Чем больше безопасных клеток откроете – тем больше награда!
      
      
🚀 Удачи! Пусть фортуна будет на вашей стороне! 🎲
      `,
      Markup.inlineKeyboard([
        [
          Markup.button.callback("💣 Продолжить", Actions.STARTTOPLAYMINES),
          Markup.button.callback(
            `Изменить · ${this.selectedMinesCount}💣`,
            Actions.CHANGEMINESCOUNT
          ),
        ],

        [Markup.button.callback("⬅️ Назад", Actions.BACKTOMENU)],
      ])
    );
  }

  // Метод для клавиатуры выбора мин
  getMinesSelectionMenu() {
    return Markup.inlineKeyboard([
      ["3", "5", "7"].map((num) =>
        Markup.button.callback(
          num == this.selectedMinesCount ? `💣 ${num}` : num,
          num
        )
      ),
      ["9", "12", "17"].map((num) =>
        Markup.button.callback(
          num == this.selectedMinesCount ? `💣 ${num}` : num,
          num
        )
      ),
      [Markup.button.callback("⬅️ Назад", Actions.BACKTOMINEMENU)],
    ]);
  }

  getChangeBetMenu(ctx: Context, user: UserSession) {
    ctx.editMessageText(
      `💸 Введите новую ставку`,
      Markup.inlineKeyboard([
        [Markup.button.callback("⬅️ Назад", Actions.BACKTOMENU)],
      ])
    );
  }

  getGamesMenu(ctx: Context, user: UserSession) {
    ctx.editMessageText(
      `🆔 Выберете игровой режим 🎮 \n \n🏦 Баланс: ${user.balance.toFixed(
        2
      )} USDT\n \n💸 Ставка: ${user.bet} USDT`,
      Markup.inlineKeyboard([
        [Markup.button.callback("✏️ Изменить ставку", Actions.CHANGEBET)],
        [
          Markup.button.callback("💣 Мины", Actions.MINESMENU),
          Markup.button.callback("🎲 Кубики", Actions.DICEMENU),
        ],
        [
          Markup.button.callback(
            "💰 Пополнить баланс",
            Actions.GETDEPOSITAMOUNTMENU
          ),
        ],
        [Markup.button.callback("⬅️ Назад", Actions.BACKTOMENU)],
      ])
    );
  }
}

// 📌 2️⃣ Храним всех пользователей (каждый юзер - объект `UserSession`)
const users = new Map();

async function setWebhook() {
  const webhookUrl = "https://4381-193-107-107-78.ngrok-free.app/webhook"; // Замени на свой URL
  try {
    await axios.post(
      `${cryptoPayApiUrl}/setWebhook`,
      { url: webhookUrl },
      {
        headers: {
          "Crypto-Pay-API-Token": cryptoPayToken,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Вебхук успешно установлен");
  } catch (error) {
    console.error("Ошибка при установке вебхука:", error);
  }
}

app.post("/webhook", async (req: any, res: any) => {
  console.log("Вебхук получен:", JSON.stringify(req.body, null, 2));

  const update = req.body;

  if (update.payload && update.payload.status === "paid") {
    console.log("Оплата завершена:", update.payload);
    const amount = parseFloat(update.payload.amount);
    const payload = JSON.parse(update.payload.payload);
    const userId = payload.userId;

    const user = users.get(userId);
    if (user) {
      if (user.referrer_id != null) {
        const reffer = new Refferal(user.referrer_id, amount);
        console.log(user);
        reffer.addRefferDeposit(amount, user.referrer_id);
        console.log("Успешно добавлено рефералу", amount);
      }
      try {
        await pool.query(
          "INSERT INTO deposits (user_id, amount) VALUES ($1, $2)",
          [userId, amount]
        );
      } catch (err) {
        console.error("Ошибка при записи в таблицу deposits", err);
      }
      console.log(`Обновляем баланс пользователя ${userId} на ${amount}`);
      await user.updateBalance(amount);
      await bot.telegram.sendMessage(
        user.userId,
        `✅ Пополнение успешно! Ваш баланс теперь: ${user.balance.toFixed(
          2
        )} USDT`,
        Markup.inlineKeyboard([
          [Markup.button.callback("🕹️ Играть", Actions.BACKTOGAMESMENU)],
        ])
      );
      console.log("Сообщение отправлено пользователю:", userId);
    } else {
      console.error(`Пользователь с ID ${userId} не найден`);
    }
  } else {
    console.log("Неверный статус или payload отсутствует:", update);
  }

  res.sendStatus(200);
});

// 📌 3️⃣ Функции для меню
function mainMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🎰 Играть", Actions.PLAY)],
    [
      Markup.button.callback("💳 Пополнить", Actions.GETDEPOSITAMOUNTMENU),
      Markup.button.callback("💸 Вывести", Actions.WITHDRAW),
    ],
    [
      Markup.button.callback(
        "🧑‍🤝‍🧑 Реферальная программа",
        Actions.REFFERAL_USER_MENU
      ),
    ],
    [Markup.button.callback("👤 Профиль", Actions.PROFILE)],
  ]);
}

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const startPayload = ctx.startPayload;
  let referrer_id = null;

  if (startPayload != null && startPayload != undefined) {
    referrer_id = startPayload;
  }
  let user = users.get(userId);
  if (!user) {
    user = new UserSession(userId, referrer_id);
    await user.load();
    users.set(userId, user);
  }

  if (user.balance === 0) {
    await user.save();
  }

  ctx.reply(
    `🚀 Добро пожаловать в Casino Rocket! 🚀

Здесь вас ждут азарт, адреналин и шанс сорвать крупный куш!

💰 Все депозиты и выплаты осуществляются через @CryptoBot, обеспечивая быстрые, надежные и анонимные транзакции.

🎲 Испытайте удачу, наслаждайтесь игрой и выигрывайте с Casino Rocket! 🚀🔥

Присоединяйтесь и начинайте игру прямо сейчас!

📰 Канал с новостями: @gamesrocketnews

🤑 Канал со ставками других игроков: @rocketgamesbet

🫂 Поддержка: @rocket_games_admin

`,
    mainMenu()
  );
});

// bot.hears("🎰 Играть", (ctx) => ctx.reply("🎮 Запуск игры..."));
// bot.hears("💳 Пополнить", (ctx) => ctx.reply("💰 Пополнение счета..."));
// bot.hears("💸 Вывести", (ctx) => ctx.reply("📤 Вывод средств..."));

bot.action(Actions.BACKTOGAMESMENU, async (ctx) => {
  const userId = ctx.from.id;
  const user = users.get(userId);
  user.navstate = NAVSTATES.GAMESMENU;
  await user.getGamesMenu(ctx, user);
});

bot.hears(/^\d+(\.\d+)?$/, async (ctx) => {
  const userId = ctx.from.id;
  const user = users.get(userId);

  // Проверяем, находится ли пользователь в состоянии изменения ставки
  if (user.navstate === NAVSTATES.CHANGEBET) {
    const newBet = parseFloat(ctx.message.text);

    // Проверяем, является ли введённое значение числом, больше 0 и меньше или равно балансу
    if (!isNaN(newBet) && newBet > 0 && newBet <= user.balance) {
      await user.setBet(newBet); // Обновляем ставку и сохраняем в БД
      user.navstate = NAVSTATES.GAMESMENU; // Возвращаем в меню игр

      await ctx.reply(
        `✅ Ставка успешно изменена на ${newBet} USDT`,
        Markup.inlineKeyboard([
          [Markup.button.callback("⬅️ Назад", Actions.BACKTOMENU)],
        ])
      );

      // Отправляем меню игр через ctx.reply вместо user.getGamesMenu
      await ctx.reply(
        `🆔 Выберете игровой режим 🎮 \n \n🏦 Баланс: ${user.balance.toFixed(
          2
        )} USDT\n \n💸 Ставка: ${user.bet} USDT`,
        Markup.inlineKeyboard([
          [Markup.button.callback("✏️ Изменить ставку", Actions.CHANGEBET)],
          [
            Markup.button.callback("💣 Мины", Actions.MINESMENU),
            Markup.button.callback("🎲 Кубики", Actions.DICEMENU),
          ],
          [
            Markup.button.callback(
              "💰 Пополнить баланс",
              Actions.GETDEPOSITAMOUNTMENU
            ),
          ],
          [Markup.button.callback("⬅️ Назад", Actions.BACKTOMENU)],
        ])
      );
    } else if (newBet > user.balance) {
      await ctx.reply(
        `❌ Ваша ставка (${newBet} USDT) превышает баланс (${user.balance.toFixed(
          2
        )} USDT). Введите меньшую сумму.`,
        Markup.inlineKeyboard([
          [Markup.button.callback("⬅️ Назад", Actions.BACKTOMENU)],
        ])
      );
    } else {
      await ctx.reply(
        `❌ Пожалуйста, введите корректное число больше 0 (например, 1.5)`,
        Markup.inlineKeyboard([
          [Markup.button.callback("⬅️ Назад", Actions.BACKTOMENU)],
        ])
      );
    }
  }

  if (user.navstate === NAVSTATES.GETDEPOSITAMOUNTMENU) {
    const depositAmount = parseFloat(ctx.message.text);
    try {
      if (depositAmount < 0.1) {
        return ctx.reply(
          "Минимальная сумма пополнения 0.5 USDT",
          Markup.inlineKeyboard([
            [Markup.button.callback("⬅️ Назад", Actions.BACKTOMENU)],
          ])
        );
      } else {
        user.navstate = NAVSTATES.DEPOSIT;
        user.depositAmount = depositAmount;
        user.getDepositMenu(ctx, user, depositAmount);
      }
    } catch (error) {}
  }

  if (user.navstate === NAVSTATES.OPENPRICEMENUFORWITHDRAW) {
    const withdrawAmount = parseFloat(ctx.message.text);
    try {
      if (!isNaN(withdrawAmount) && withdrawAmount > 0) {
        // const withdrawAmountWithString = withdrawAmount.toString();
        const withdrawAmountWithString = String(withdrawAmount);
        await user.withdrawFunds(ctx, withdrawAmountWithString);
        user.navstate = NAVSTATES.MAINMENU; // Возвращаем в главное меню после вывода
      } else {
        await ctx.reply(
          `❌ Пожалуйста, введите корректное число больше 0 (например, 3.5)`,
          Markup.inlineKeyboard([
            [Markup.button.callback("⬅️ Назад", Actions.BACKTOMENU)],
          ])
        );
      }
    } catch (error: any) {
      await ctx.reply(
        `❌ Ошибка: ${error.message}`,
        Markup.inlineKeyboard([
          [Markup.button.callback("⬅️ Назад", Actions.BACKTOMENU)],
        ])
      );
    }
  }
});

bot.action(Actions.OPEN_ACTIVE_REFERALS, async (ctx) => {
  const userId = ctx.from.id;
  const user = users.get(userId);
  user.navstate = NAVSTATES.OPEN_ACTIVE_REFERALS;
  await user.getActiveRefferalUserMenu(ctx, user);
});

bot.action(Actions.MINESMENU, async (ctx) => {
  const userId = ctx.from.id;
  const user = users.get(userId);
  user.navstate = NAVSTATES.MINESMENU; // Запоминаем, что юзер в меню мин
  await user.getMinesMenu(ctx, user);
});

bot.action(Actions.WITHDRAW_REFERALS_CASH, async (ctx) => {
  const userId = ctx.from.id;
  const user = users.get(userId);
  user.navstate = NAVSTATES.WITHDRAW_REFERALS_CASH;
  await user.getWithdrawReferalsMenu(ctx, user);
});

bot.action(Actions.WITHDRAW, async (ctx) => {
  const userId = ctx.from.id;
  const user = users.get(userId);
  user.navstate = NAVSTATES.WITHDRAW;
  await user.getWithdrawMenu(ctx, user);
});

bot.action(Actions.OPENPRICEMENUFORWITHDRAW, async (ctx) => {
  const userId = ctx.from.id;
  const user = users.get(userId);
  user.navstate = NAVSTATES.OPENPRICEMENUFORWITHDRAW;
  await user.getOpenPriceMenuForWithdraw(ctx, user);
});

bot.action(Actions.CHANGEBET, async (ctx) => {
  const userId = ctx.from.id;
  const user = users.get(userId);
  user.navstate = NAVSTATES.CHANGEBET;
  await user.getChangeBetMenu(ctx, user);
});

bot.action(Actions.COLLECTWINMINESBOT, async (ctx) => {
  const userId = ctx.from.id;
  const user = users.get(userId);
  user.navstate = NAVSTATES.COLLECTEDCASH;
  const game = user.currentGame;

  await game.collectWinCash(ctx, user);
});

bot.action(Actions.DEPOSIT, async (ctx) => {
  const userId = ctx.from.id;
  const user = users.get(userId);
  user.navstate = NAVSTATES.DEPOSIT;
  await user.getDepositMenu(ctx, user);
});

bot.action(Actions.GETDEPOSITAMOUNTMENU, async (ctx) => {
  const userId = ctx.from.id;
  const user = users.get(userId);
  user.navstate = NAVSTATES.GETDEPOSITAMOUNTMENU;
  await user.getAmountOfDepositMenu(ctx, user);
});

bot.action(/^cell_(\d+)_(\d+)$/, async (ctx) => {
  const [, row, col] = ctx.match;
  const cellId = `${row}_${col}`;
  const userId = ctx.from.id;
  const user = users.get(userId);
  if (user.navstate === NAVSTATES.MINESGAME) {
    const game = user.currentGame;
    const result = game.handleCellClick(parseInt(row, 10), parseInt(col, 10));

    if (result.isMine) {
      user.updateBalance(-user.bet);
      // Если это мина, завершаем игру
      await ctx.editMessageText(
        `💥 Вы нашли мину! Игра окончена.\n `,
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "Вернуться к играм",
              Actions.BACKTOGAMESMENU
            ),
          ],
        ])
      );
      user.navstate = NAVSTATES.MAINMENU; // Возвращаем в главное меню
    } else {
      // Если клетка безопасна, обновляем интерфейс
      await ctx.editMessageText(
        `💣 Мины · ${user.selectedMinesCount} \n 💰 Выигрыш · ${
          user.bet
        } → ${game.getWinCash()} USDT \n 📊 Следующий коэффициент · ${game.getNextCoef()} `,
        game.getUpdatedKeyboard()
      );
    }
  }
});

bot.action(Actions.CHANGEMINESCOUNT, (ctx) => {
  const userId = ctx.from.id;
  const user = users.get(userId);
  user.navstate = NAVSTATES.CHANGEMINESCOUNT; // Запоминаем, что юзер выбирает мины
  ctx.editMessageText(
    "🔢 Выбери количество мин:",
    user.getMinesSelectionMenu()
  );
});

bot.action(Actions.REFFERAL_USER_MENU, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const user = users.get(userId);
    user.navstate = NAVSTATES.REFFERAL_USER_MENU;
    await user.getRefferalUserMenu(ctx, user);
  } catch (error) {
    ctx.reply(
      "Произошла ошибка. Попробуйте снова, введите команду /start или обратитесь в поддержку."
    );
    console.log("Ошибка при редактировании сообщения:", error);
  }
});

bot.action(Actions.BACKTOMENU, async (ctx) => {
  const userId = ctx.from.id;
  const user = users.get(userId);
  user.navstate = NAVSTATES.MAINMENU;
  await ctx.editMessageText(
    `🚀 Добро пожаловать в Casino Rocket! 🚀

Здесь вас ждут азарт, адреналин и шанс сорвать крупный куш!

💰 Все депозиты и выплаты осуществляются через @CryptoBot, обеспечивая быстрые, надежные и анонимные транзакции.

🎲 Испытайте удачу, наслаждайтесь игрой и выигрывайте с Casino Rocket! 🚀🔥

Присоединяйтесь и начинайте игру прямо сейчас!

📰 Канал с новостями: @gamesrocketnews

🤑 Канал со ставками других игроков: @rocketgamesbet

🫂 Поддержка: @rocket_games_admin
`,
    mainMenu() // Отправляем главное меню
  );
});

bot.action(Actions.BACKTOMINEMENU, async (ctx) => {
  const userId = ctx.from.id;
  const user = users.get(userId);
  user.navstate = NAVSTATES.MINESGAME;
  await user.getMinesMenu(ctx, user);
});

bot.action(Actions.MINESMENU, async (ctx) => {});

bot.action(["3", "5", "7", "9", "12", "17"], async (ctx: any) => {
  const userId = ctx.from.id;
  const user = users.get(userId);
  const mines_count = ctx.match[0];
  user.setMinesCount(mines_count);
  ctx.editMessageText(
    `Ты выбрал ${user.selectedMinesCount} мин!`,
    user.getMinesSelectionMenu()
  );
});

bot.action(Actions.STARTTOPLAYMINES, async (ctx) => {
  const userId = ctx.from.id;
  const user = users.get(userId);

  if (user.balance < user.bet || user.balance <= 0) {
    ctx.editMessageText("У вас недостаточно средств для игры", mainMenu());
    user.navstate = NAVSTATES.MAINMENU;
    return;
  }
  user.navstate = NAVSTATES.MINESGAME;
  const gameSession = new GameSession(user, GAMES.MINES);
  gameSession.startGame(ctx);
});

bot.action(Actions.PLAY, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const user = users.get(userId);
    user.navstate = NAVSTATES.GAMESMENU;

    await user.getGamesMenu(ctx, user);
  } catch (error) {
    ctx.reply(
      "Произошла ошибка. Попробуйте снова, введите команду /start или обратитесь в поддержку."
    );
    console.log("Ошибка при начале игры:", error);
  }
});

bot.action(Actions.PROFILE, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const user = users.get(userId);
    user.navstate = NAVSTATES.PROFILEMENU;

    await user.getUserProfile(ctx, user);
  } catch (error) {
    ctx.reply(
      "Произошла ошибка. Попробуйте снова, введите команду /start или обратитесь в поддержку."
    );
    console.log("Ошибка при редактировании сообщения:", error);
  }
});

bot.action(Actions.DICEMENU, async (ctx) => {
  const userId = ctx.from.id;
  const user = users.get(userId);
  user.navstate = NAVSTATES.DICEMENU;
  await user.getDiceMenu(ctx, user);
});

bot.action(Actions.CRYPTOBOT, async (ctx) => {
  const userId = ctx.from.id;
  const user = users.get(userId);
  user.navstate = NAVSTATES.DEPOSIT;
  await user.OpenCryptoBot(ctx, user);
});

bot.action(Actions.EVENDICE, async (ctx) => {
  const userId = ctx.from.id;
  const user = users.get(userId);
  if (user.balance < user.bet || user.balance <= 0) {
    ctx.editMessageText("У вас недостаточно средств для игры", mainMenu());
    user.navstate = NAVSTATES.MAINMENU;
    return;
  }
  user.navstate = NAVSTATES.DICEGAME;
  user.selectedDiceGameType = DICEGAMETYPES.EVEN;
  const gameSession = new GameSession(user, GAMES.DICE);
  gameSession.startGame(ctx);
});

bot.action(Actions.ODDDICE, async (ctx) => {
  const userId = ctx.from.id;
  const user = users.get(userId);
  if (user.balance < user.bet || user.balance <= 0) {
    ctx.editMessageText("У вас недостаточно средств для игры", mainMenu());
    user.navstate = NAVSTATES.MAINMENU;
    return;
  }
  user.navstate = NAVSTATES.DICEGAME;
  user.selectedDiceGameType = DICEGAMETYPES.ODD;
  const gameSession = new GameSession(user, GAMES.DICE);
  gameSession.startGame(ctx);
});

bot.action(Actions.MOREDICE, async (ctx) => {
  const userId = ctx.from.id;
  const user = users.get(userId);
  if (user.balance < user.bet || user.balance <= 0) {
    ctx.editMessageText("У вас недостаточно средств для игры", mainMenu());
    user.navstate = NAVSTATES.MAINMENU;
    return;
  }
  user.navstate = NAVSTATES.DICEGAME;
  user.selectedDiceGameType = DICEGAMETYPES.MORE;
  const gameSession = new GameSession(user, GAMES.DICE);
  gameSession.startGame(ctx);
});

bot.action(Actions.LESSDICE, async (ctx) => {
  const userId = ctx.from.id;
  const user = users.get(userId);
  if (user.balance < user.bet) {
    ctx.editMessageText("У вас недостаточно средств для игры", mainMenu());
    user.navstate = NAVSTATES.MAINMENU;
    return;
  }
  user.navstate = NAVSTATES.DICEGAME;
  user.selectedDiceGameType = DICEGAMETYPES.LESS;
  const gameSession = new GameSession(user, GAMES.DICE);
  gameSession.startGame(ctx);
});
const PORT = 4000;
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
    console.log("🤖 Бот запущен! :))");
  })
  .catch((err) => {
    console.error("Ошибка при запуске бота:", err);
  });

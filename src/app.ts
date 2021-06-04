import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });
import Bot from './lib/Bot';
import Options from './lib/Option';

export const bot = new Bot();
export const options = new Options();

void options.init();

void bot.start();

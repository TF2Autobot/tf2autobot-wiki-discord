import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });
import Bot from './lib/Bot';
import Options from './lib/Option';

export const bot = new Bot();
export const options = new Options();

void options.init();

import ON_DEATH from 'death';
import * as inspect from 'util';
import log from './lib/Logger';

ON_DEATH({ uncaughtException: true })((signalOrErr, origin) => {
    const crashed = signalOrErr !== 'SIGINT';

    if (crashed) {
        const botReady = typeof bot.client.readyTimestamp === 'number';

        log.error(
            [
                'GiveawayBot' +
                    (!botReady
                        ? ' failed to start properly, this is most likely a temporary error. See the log:'
                        : ' crashed! Please create an issue with the following log:'),
                `package.version: ${process.env.BOT_VERSION || undefined}; node: ${process.version} ${
                    process.platform
                } ${process.arch}}`,
                'Stack trace:',
                inspect.inspect(origin)
            ].join('\r\n')
        );

        if (botReady) {
            log.error('Please inform IdiNium, Thanks.');
        }
    } else {
        log.warn('Received kill signal `' + (signalOrErr as string) + '`');
    }

    bot.stop();
    process.exit(1);
});

process.on('message', message => {
    if (message === 'shutdown') {
        log.warn('Process received shutdown message, stopping...');

        bot.stop();
        process.exit(1);
    } else {
        log.warn('Process received unknown message `' + (message as string) + '`');
    }
});

void bot.start();

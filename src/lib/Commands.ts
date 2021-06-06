import { options } from '../app';
import { Message, MessageReaction } from 'discord.js';
const channels = JSON.parse(process.env.CHANNEL_IDS) as string[];

function commandParser(message: string): [string, string] {
    // filter out empty spaces ie message is .test  2 => ['.test', '','2'] => ['.test', '2']
    const splitMessage = message.split(' ').filter(i => i);
    if (splitMessage[1].match(/^["']/)) {
        // to make .test "test\" hehe" usable
        const endIndex = splitMessage.findIndex(i => i.match(/[^\\]['"]$/)) + 1;
        if (!endIndex) throw 'Missing ending quote.';
        const command = splitMessage
            .slice(1, endIndex)
            .join(' ')
            .replace(/\\(['"])/g, '$1');

        return [command.substring(1, command.length - 1), splitMessage.slice(endIndex).join(' ')];
    }

    return [splitMessage[1], splitMessage.slice(2).join(' ')];
}

interface RecentlySent {
    reply: { [id: string]: number };
    command: { [cmd: string]: number };
}

interface RecentlySentTimeouts {
    reply: { [id: string]: NodeJS.Timeout };
    command: { [cmd: string]: NodeJS.Timeout };
}

export default class Commands {
    private recentlySent: RecentlySent;

    private recentlySentTimeouts: RecentlySentTimeouts;

    init(): void {
        this.recentlySent = { reply: {}, command: {} };
        this.recentlySentTimeouts = { reply: {}, command: {} };
    }

    stop(): void {
        this.recentlySent = undefined;
        this.recentlySentTimeouts = undefined;
    }

    private resetAfter3Seconds(type: 'reply' | 'command', idOrCommand: string): void {
        this.recentlySentTimeouts[type][idOrCommand] = setTimeout(() => {
            delete this.recentlySent[type][idOrCommand];
        }, 3000);
    }

    private checkSpam(command: string, id: string): string | 'bruh' | null {
        clearTimeout(this.recentlySentTimeouts.reply[id]);
        clearTimeout(this.recentlySentTimeouts.command[command]);
        this.recentlySent.command[command] ??= 0;
        this.recentlySent.command[command]++;

        // Allows the command to be used once every 3 seconds.
        if (this.recentlySent.command[command] > 1) {
            this.resetAfter3Seconds('command', command);
            if (this.recentlySent.command[command] > 3) {
                return 'bruh';
            }

            return `I have just sent a reply for that ⛔`;
        }

        this.recentlySent.reply[id] ??= 0;
        this.recentlySent.reply[id]++;

        // Allows the command to be used twice every 3 seconds.
        if (this.recentlySent.reply[id] > 2) {
            this.resetAfter3Seconds('reply', id);
            if (this.recentlySent.reply[id] > 3) {
                return 'bruh';
            }

            return `Bruh stop spamming ⛔`;
        }

        this.resetAfter3Seconds('reply', id);
        this.resetAfter3Seconds('command', command);

        return null;
    }

    //message should be type of Message from discord but that way typescript throws error on line 8
    public async handleMessage(message: Message): Promise<Message | MessageReaction> {
        //check for auto-response and if found dont continue
        if (channels.includes(message.channel.id)) {
            const messageOptions = options.getOption(message.content);
            if (messageOptions[1]) {
                const spam = this.checkSpam(messageOptions[0], message.author.id);
                if (spam === 'bruh') {
                    return message.react('🤬');
                }

                if (spam === null) {
                    message.react('👍');
                }

                return message.reply((spam || messageOptions[1]) as string);
            }
        }

        //dont continue if doesnt start with prefix or is an other bot
        const prefix = options.currentOptions.prefix;
        const roleID = options.currentOptions.roleID;
        if (!message.content.startsWith(prefix) || message.author.bot) {
            return;
        }

        //get arguments and command
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().trim();

        const isOwner = message.guild.ownerID === message.author.id;
        if (!message.member.roles.cache.find(r => r.id == roleID) && !isOwner) {
            if (command === 'list') {
                const checkSpam = this.checkSpam(command, message.author.id);
                if (checkSpam === 'bruh') {
                    return message.react('🤬');
                }

                if (checkSpam === null) {
                    message.react('👍');
                }

                return message.reply(checkSpam || options.getList());
            }

            return;
        }

        //check if its on correct channel
        if (!channels.includes(message.channel.id) && channels.length != 0) {
            message.react('❌');
            return message.reply(
                `Any commands should be run on ${channels.map(channel => `<#${channel}>`).join(', ')}`
            );
        }

        if (command === 'prefix' && isOwner) {
            //check for missing arguments cause people dumb
            if (args.length < 1) {
                message.react('✋');
                return message.reply(`Correct Usage: ${prefix}prefix newPrefix.`);
            }

            const newPrefix = args.shift();
            options.handleBaseOptionOrAlias('prefix', newPrefix);
            message.react('✅');
            return message.reply(`Changed prefix from ${prefix} to ${newPrefix}`);
        } else if (command === 'setRole' && isOwner) {
            if (args.length < 1) {
                message.react('✋');
                return message.reply(`Correct Usage: ${prefix}setRole roleID.`);
            }

            const newRole = args.shift();
            options.handleBaseOptionOrAlias('roleID', newRole);
            message.react('✅');
            return message.reply(`Changed roleID to ${newRole}`);
        } else if (command === 'add') {
            if (args.length < 2 && !message.attachments.first()) {
                message.react('✋');
                return message.reply(`Correct Usage: ${prefix}add command response.`);
            }

            try {
                const [devCommand, devResponse] = commandParser(message.content);
                if (['prefix', 'roleID'].includes(devCommand)) {
                    message.react('❌');
                    return message.reply(`Can not add base value ${devCommand} as a command.`);
                }

                if (options.getOption(devCommand)[1] != undefined) {
                    message.react('❌');
                    return message.reply(`Auto-reply for ${'`' + devCommand + '`'} already exists.`);
                }

                options.handleOption(devCommand, devResponse, message.attachments.array());
                message.react('✅');
                return message.channel.send(
                    `Added auto-reply: ${'`' + devCommand + '`'}, ${
                        devResponse
                            ? 'with the response:\n> ' + devResponse.replace('\n', '\n> ')
                            : 'with the attachment:\n'
                    }`,
                    { files: message.attachments.array() }
                );
            } catch (err) {
                message.react('❌');
                return message.reply(err);
            }
        } else if (command === 'remove') {
            //check for missing arguments cause people dumb
            if (args.length < 1) {
                message.react('✋');
                return message.reply(`Correct Usage: ${prefix}remove command.`);
            }

            const delCommand = args.filter(i => i).join(' ');
            if (['prefix', 'roleID'].includes(delCommand)) {
                return message.reply(`Can not remove base value ${delCommand}.`);
            }

            const isAlias = typeof options.getOption(delCommand, true)[1] === 'string' ? 'alias' : '';
            options.deleteCommand(delCommand);
            message.react('🚮');
            return message.reply(`Deleted auto-reply for ${isAlias} ${'`' + delCommand + '`'}`);
        } else if (command === 'edit') {
            //check for missing arguments cause people dumb
            if (args.length < 2 && !message.attachments.first()) {
                message.react('✋');
                return message.reply(`Correct Usage: ${prefix}edit command newResponse.`);
            }

            try {
                const [devCommand, devResponse] = commandParser(message.content);
                if (['prefix', 'roleID'].includes(devCommand)) {
                    message.react('❌');
                    return message.reply(`Can not add base value ${devCommand} as a command.`);
                }

                if (options.getOption(devCommand)[1] != undefined) {
                    options.handleOption(devCommand, devResponse, message.attachments.array());
                    message.react('✅');
                    return message.channel.send(
                        `Edited auto-reply: ${'`' + devCommand + '`'}, ${
                            devResponse
                                ? 'with the response:\n> ' + devResponse.replace('\n', '\n> ')
                                : 'with the attachment:\n'
                        }.`,
                        { files: message.attachments.array() }
                    );
                }

                message.react('❌');
                return message.reply(`Auto-reply for ${'`' + devCommand + '`'} doesn't exist.`);
            } catch (err) {
                message.react('❌');
                return message.reply(err);
            }
        } else if (command === 'list') {
            message.react('✅');
            return message.reply(options.getList());
        } else if (command === 'alias') {
            if (args.length < 2) {
                message.react('✋');
                return message.reply(`Correct Usage: ${prefix}alias !help help.\nor: "not found" file not found`);
            }
            try {
                const [devAlias, devExistingCMD] = commandParser(message.content);
                if (['prefix', 'roleID'].includes(devAlias)) {
                    message.react('❌');
                    return message.reply(`Can not alias base value ${devAlias} as a command.`);
                }

                if (['prefix', 'roleID'].includes(devExistingCMD)) {
                    message.react('❌');
                    return message.reply(`Can not alias base value ${devExistingCMD} as a target.`);
                }

                if (options.getOption(devExistingCMD)[1] === undefined) {
                    message.react('❌');
                    return message.reply(`Can not target alias for ${'`' + devExistingCMD + '`'} it doesn't exist.`);
                }

                if (options.getOption(devAlias)[1] !== undefined) {
                    message.react('❌');
                    return message.reply(`Can not alias ${devAlias} as it already exists remove it first.`);
                }

                options.handleBaseOptionOrAlias(devAlias, options.getOption(devExistingCMD)[0]);
                message.react('✅');
                return message.channel.send(`Added alias ${devAlias} => ${options.getOption(devExistingCMD)[0]}`);
            } catch (err) {
                message.react('❌');
                return message.reply(err);
            }
        } else if (command === 'rename') {
            if (args.length < 2) {
                message.react('✋');
                return message.reply(
                    `Correct Usage: ${prefix}rename !help help.\nor: ${prefix}rename "not found" file not found`
                );
            }

            try {
                const [devCurrent, devRename] = commandParser(message.content);
                if (['prefix', 'roleID'].includes(devCurrent)) {
                    message.react('❌');
                    return message.reply(`Can not rename base value ${'`' + devCurrent + '`'}.`);
                }
                if (['prefix', 'roleID'].includes(devRename)) {
                    message.react('❌');
                    return message.reply(`Can not rename to base value ${'`' + devRename + '`'}.`);
                }
                if (options.getOption(devCurrent)[1] === undefined) {
                    message.react('❌');
                    return message.reply(`Can not rename ${'`' + devCurrent + '`'} it doesn't exist.`);
                }
                if (options.getOption(devRename)[1] !== undefined) {
                    message.react('❌');
                    return message.reply(`Can not rename to ${'`' + devRename + '`'} as it already exists.`);
                }

                options.renameCommand(devCurrent, devRename);

                message.react('✅');
                return message.channel.send(`Renamed ${'`' + devCurrent + '`'} => ${'`' + devRename + '`'}`);
            } catch (err) {
                message.react('❌');
                return message.reply(err);
            }
        }
    }
}

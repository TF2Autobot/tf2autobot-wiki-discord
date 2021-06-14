import { options } from '../app';
import { Message, MessageReaction } from 'discord.js';
const channels = JSON.parse(process.env.CHANNEL_IDS) as string[];

function commandParser(message: string): [...ReturnType<typeof options['getOption']>, string] {
    let cmd = '';
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

        cmd = command.substring(1, command.length - 1);
        message = splitMessage.slice(endIndex).join(' ');
    } else {
        cmd = splitMessage[1];
        message = splitMessage.slice(2).join(' ');
    }
    let addToMessage: string[] = [];

    // take out newline from command
    [cmd, ...addToMessage] = cmd.split('\n');

    // Convert mobile user tagging to desktop version: <@!userid> => <@userid>
    cmd.replace(/<@!(\d+)>/g, '<@$1>');
    return [...options.getOption(cmd), (addToMessage.join('\n') + ' ' + message).trimStart()];
}
function addOrEditCommand(command: 'add' | 'edit', isMeme: boolean, args: string[], message: Message) {
    const prefix = options.currentOptions.prefix;
    const usageMessage = prefix + command + (isMeme ? 'Meme' : '');
    const isAdd = command === 'add';
    const isEditMeme = command === 'edit' && isMeme;

    if (args.length < 2 && (isEditMeme || !message.attachments.first())) {
        message.react('✋');
        return message.reply(
            `**Correct Usage**: \`${usageMessage} <${isAdd ? 'new' : 'currentExisting'}Keyword> <${
                isEditMeme ? 'true|false' : 'response'
            }>\`` +
                (usageMessage === '.addMeme'
                    ? `\n__Example__:\n- ${usageMessage} pog <a:OrangePog:791909949650370610>`
                    : usageMessage === '.editMeme'
                    ? `\n__Example__:\n- ${usageMessage} pog true`
                    : `\n__Example__:\n- ${usageMessage} pm2 Short for Process Manager 2` +
                      `\n- ${usageMessage} "manual review" You manually review and then manually accept/decline` +
                      `\n\n📌Note📌\n\`<response>\` can either be descriptions together with an attachment, or just an attachment (i.e. image, file).`)
        );
    }

    try {
        const [devCommand, devObject, devResponse] = commandParser(message.content);
        if (['prefix', 'roleID'].includes(devCommand)) {
            throw `Can not \`${command}\` base value \`${devCommand}\` as a command.`;
        }

        if (isAdd === (devObject != undefined)) {
            throw `Auto-reply for \`${devCommand}\` ${isAdd ? 'already exists' : "doesn't exist"}.`;
        }

        if (isEditMeme) {
            if (typeof options.getOption(devCommand, true)[1] === 'string')
                throw `Can not edit isMeme parameter of \`${devCommand}\` as it is an alias.`;
            const setMemeTo = devResponse === 'true' ? true : devResponse === 'false' ? false : null;
            if (setMemeTo === null) {
                throw (
                    `Can not edit isMeme parameter of \`${devCommand}\` to \`${devResponse}\` ` +
                    `as it should be only \`true\` or \`false\`.`
                );
            }
            options.handleOptionParam(devCommand, 'isMeme', setMemeTo);
            message.react('✅');
            return message.channel.send(`Edited isMeme parameter of \`${devCommand}\` to \`${devResponse}\`.`);
        }

        options.handleOption(
            devCommand,
            devResponse,
            message.attachments.array(),
            isAdd && !isEditMeme ? isMeme : devObject.isMeme
        );
        message.react('✅');
        return message.channel.send(
            `${isAdd ? 'Add' : 'Edit'}ed auto-reply: \`${devCommand}\`, ${
                devResponse ? 'with the response:\n> ' + devResponse.replace('\n', '\n> ') : 'with the attachment:\n'
            }`,
            { files: message.attachments.array() }
        );
    } catch (err) {
        message.react('❌');
        return message.reply(err);
    }
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

    public async handleMessage(message: Message): Promise<Message | MessageReaction> {
        if (message.author.bot) return;

        //check for auto-response and if found dont continue

        const messageOptions = options.getOption(message.content);
        if (messageOptions[1] && (messageOptions[1].isMeme || channels.includes(message.channel.id))) {
            const spam = this.checkSpam(messageOptions[0], message.author.id);
            if (spam === 'bruh') {
                return message.react('🤬');
            }

            if (spam === null) {
                message.react('👍');
            }

            if (spam || !messageOptions[1].isMeme) {
                return message.reply((spam || messageOptions[1]) as string);
            }

            return message.channel.send(messageOptions[1] as string);
        }

        //dont continue if doesnt start with prefix or is an other bot
        const prefix = options.currentOptions.prefix;
        const roleID = options.currentOptions.roleID;
        if (!message.content.startsWith(prefix)) {
            return;
        }

        //get arguments and command
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().trim();

        const isOwner = message.guild.ownerID === message.author.id;
        if (!message.member.roles.cache.find(r => r.id == roleID) && !isOwner) {
            if (command === 'list' || command === 'memeList') {
                const checkSpam = this.checkSpam(command, message.author.id);
                if (checkSpam === 'bruh') {
                    return message.react('🤬');
                }

                if (checkSpam === null) {
                    message.react('👍');
                }

                return message.reply(checkSpam || options.getList(command === 'memeList'));
            }

            return;
        }

        if (
            ![
                'prefix',
                'setRole',
                'add',
                'edit',
                'addMeme',
                'editMeme',
                'remove',
                'list',
                'memeList',
                'alias',
                'rename'
            ].includes(command)
        ) {
            return;
        }

        // check if its on correct channel
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
                return message.reply(`**Correct Usage**: \`${prefix}prefix <newPrefix>\``);
            }

            const newPrefix = args.shift();
            options.handleBaseOptionOrAlias('prefix', newPrefix);
            message.react('✅');
            return message.reply(`Changed prefix from \`${prefix}\` to \`${newPrefix}\``);
        } else if (command === 'setRole' && isOwner) {
            if (args.length < 1) {
                message.react('✋');
                return message.reply(`**Correct Usage**: \`${prefix}setRole <roleID>\``);
            }

            const newRole = args.shift();
            options.handleBaseOptionOrAlias('roleID', newRole);
            message.react('✅');
            return message.reply(`Changed roleID to \`${newRole}\``);
        } else if (['add', 'edit', 'addMeme', 'editMeme'].includes(command)) {
            addOrEditCommand(command.replace('Meme', '') as 'add' | 'edit', command.includes('Meme'), args, message);
        } else if (command === 'remove') {
            //check for missing arguments cause people dumb
            if (args.length < 1) {
                message.react('✋');
                return message.reply(`**Correct Usage**: \`${prefix}remove <existingKeyword>\``);
            }

            const delCommand = args.filter(i => i).join(' ');
            const opt = options.getOption(delCommand, true);
            if (['prefix', 'roleID'].includes(opt[0])) {
                return message.reply(`Can not remove base value \`${opt[0]}\``);
            }

            if (!opt[1]) {
                message.react('❌');
                return message.reply(`Couldn't delete command \`${delCommand}\` as it doesn't exist.`);
            }
            const isAlias = typeof opt[1] === 'string' ? 'alias' : '';
            options.deleteCommand(opt[0]);
            message.react('🚮');
            return message.reply(`Deleted auto-reply for ${isAlias} \`${opt[0]}\``);
        } else if (command === 'list' || command === 'memeList') {
            message.react('✅');
            return message.reply(options.getList(command === 'memeList'));
        } else if (command === 'alias') {
            if (args.length < 2) {
                message.react('✋');
                return message.reply(
                    `**Correct Usage**: \`${prefix}alias <newAlias> <currentExistingKeyword>\`` +
                        `\n__Example__:\n- ${prefix}alias !help help\n- "not found" file not found`
                );
            }
            try {
                const [devAlias, devObject, devExistingCMD] = commandParser(message.content);
                const existingCMD = options.getOption(devExistingCMD);

                if (['prefix', 'roleID'].includes(devAlias)) {
                    message.react('❌');
                    return message.reply(`Can not alias base value \`${devAlias}\` as a command.`);
                }

                if (['prefix', 'roleID'].includes(existingCMD[0])) {
                    message.react('❌');
                    return message.reply(`Can not alias base value \`${devExistingCMD}\` as a target.`);
                }

                if (existingCMD[1] === undefined) {
                    message.react('❌');
                    return message.reply(`Can not target alias for \`${devExistingCMD}\` it doesn't exist.`);
                }

                if (devObject !== undefined) {
                    message.react('❌');
                    return message.reply(`Can not alias \`${devAlias}\` as it already exists remove it first.`);
                }

                options.handleBaseOptionOrAlias(devAlias, existingCMD[0]);
                message.react('✅');
                return message.channel.send(`Added alias \`${devAlias}\` => \`${existingCMD[0]}\``);
            } catch (err) {
                message.react('❌');
                return message.reply(err);
            }
        } else if (command === 'rename') {
            if (args.length < 2) {
                message.react('✋');
                return message.reply(
                    `**Correct Usage**: \`${prefix}rename <currentExistingKeyword> <newKeyword>\`` +
                        `\n__Example__:\n- ${prefix}rename !help help` +
                        `\n- ${prefix}rename "not found" file not found`
                );
            }

            try {
                const [devCurrent, devObject, devRename] = commandParser(message.content);
                const renameCMD = options.getOption(devRename);

                if (['prefix', 'roleID'].includes(devCurrent)) {
                    message.react('❌');
                    return message.reply(`Can not rename base value \`${devCurrent}\`.`);
                }
                if (['prefix', 'roleID'].includes(renameCMD[0])) {
                    message.react('❌');
                    return message.reply(`Can not rename to base value \`${devRename}\`.`);
                }

                if (devObject === undefined) {
                    message.react('❌');
                    return message.reply(`Can not rename \`${devCurrent}\` it doesn't exist.`);
                }
                if (renameCMD[1] !== undefined) {
                    message.react('❌');
                    return message.reply(`Can not rename to \`${devRename}\` as it already exists.`);
                }

                options.renameCommand(devCurrent, devRename);

                message.react('✅');
                return message.channel.send(`Renamed \`${devCurrent}\` => \`${devRename}\``);
            } catch (err) {
                message.react('❌');
                return message.reply(err);
            }
        }
    }
}

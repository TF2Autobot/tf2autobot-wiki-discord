import { options } from '../app';
import { Message } from 'discord.js';
const channels = JSON.parse(process.env.CHANNEL_IDS) as string[];

function commandParser(message: string): [string, string] {
    // filter out empty spaces ie message is .test  2 => ['.test', '','2'] => ['.test', '2']
    const splitMessage = message.split(' ').filter(i => i);
    if (splitMessage[1].match(/^["']/)) {
        // to make .test "test\" hehe" usable
        const endIndex = splitMessage.findIndex(i => i.match(/[^\\]['"]$/)) + 1
        if (!endIndex) throw "Missing ending quote."
        const command = splitMessage.slice(1, endIndex).join(' ').replace(/\\(['"])/g, "$1")

        return [command.substring(1, command.length - 1), splitMessage.slice(endIndex).join(' ')]
    }

    return [splitMessage[1], splitMessage.slice(2).join(' ')]
}

export default class Commands {
    private recentlySent: { reply: { [id: string]: number }; command: { [cmd: string]: number } };

    private recentlySentTimeouts: { reply: { [id: string]: NodeJS.Timeout }; command: { [cmd: string]: NodeJS.Timeout } };

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

    private checkSpam(command: string, id: string): string {
        clearTimeout(this.recentlySentTimeouts.reply[id]);
        clearTimeout(this.recentlySentTimeouts.command[command]);
        this.recentlySent.command[command] ??= 0;
        this.recentlySent.command[command]++;

        // Allows the command to be used once every 3 seconds.
        if (
            this.recentlySent.command[command] > 1
        ) {
            this.resetAfter3Seconds('command', command);
            return `I have just sent a reply for that ⛔`;
        }

        this.recentlySent.reply[id] ??= 0;
        this.recentlySent.reply[id]++;

        // Allows the command to be used twice every 3 seconds.
        if (
            this.recentlySent.reply[id] > 2
        ) {
            this.resetAfter3Seconds('reply', id);
            return `Bruh stop spamming ⛔`;
        }

        this.resetAfter3Seconds('reply', id);
        this.resetAfter3Seconds('command', command);
    }

    //message should be type of Message from discord but that way typescript throws error on line 8
    public async handleMessage(message: Message): Promise<Message> {
        //check for auto-response and if found dont continue
        if (channels.includes(message.channel.id)) {
            const messageOptions = options.getOption(message.content)
            if (messageOptions) {
                const reply = this.checkSpam(messageOptions[0], message.author.id) || messageOptions[1]
                // Typescript goes crazy for some reason if I don't make this any
                return message.reply(reply as any);
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
                return message.reply(this.checkSpam(command, message.author.id) || options.getList());
            }

            return;
        }

        //check if its on correct channel
        if (!channels.includes(message.channel.id) && channels.length != 0) {
            return message.reply(
                `Any commands should be run on ${channels.map(channel => `<#${channel}>`).join(', ')}`
            );
        }
        if (command === 'prefix') {
            //check for missing arguments cause people dumb
            if (args.length < 1) {
                return message.reply(`Correct Usage: ${prefix}prefix newPrefix.`);
            }
            let newPrefix = args.shift();
            options.handleBaseOptionOrAlias("prefix", newPrefix);
            return message.reply(`Changed prefix from ${prefix} to ${newPrefix}`);
        } else if (command === 'add') {
            if (args.length < 2 && !message.attachments.first()) {
                return message.reply(`Correct Usage: ${prefix}add command response.`);
            }
            try {
                const [devCommand, devResponse] = commandParser(message.content);
                if (["prefix", "roleID"].includes(devCommand)) return message.reply(`Can not add base value ${devCommand} as a command.`)
                if (options.getOption(devCommand)[1] != undefined) {
                    return message.reply(`Auto-reply for ${'`' + devCommand + '`'} already exists.`);
                }
                options.handleOption(devCommand, devResponse, message.attachments.array());
                return message.channel.send(
                    `Added auto-reply: ${'`' + devCommand + '`'}, ${devResponse ? ("with the response: \n> " + devResponse) : "with the attachment: \n>"}.`,
                    { files: message.attachments.array() }
                );
            } catch (err) {
                return message.reply(err)
            }
        } else if (command === 'remove') {
            //check for missing arguments cause people dumb
            if (args.length < 1) {
                return message.reply(`Correct Usage: ${prefix}remove command.`);
            }
            let delCommand = args.filter(i => i).join(' ');
            if (["prefix", "roleID"].includes(delCommand)) return message.reply(`Can not remove base value ${delCommand}.`)
            const isAlias = typeof options.getOption(delCommand, true)[1] === "string" ? "alias" : ""
            options.deleteCommand(delCommand);
            return message.reply(`Deleted auto-reply for ${isAlias} ${'`' + delCommand + '`'}`);
        } else if (command === 'edit') {
            //check for missing arguments cause people dumb
            if (args.length < 2 && !message.attachments.first()) {
                return message.reply(`Correct Usage: ${prefix}edit command newResponse.`);
            }
            try {
                const [devCommand, devResponse] = commandParser(message.content);
                if (["prefix", "roleID"].includes(devCommand)) return message.reply(`Can not add base value ${devCommand} as a command.`)
                if (options.getOption(devCommand)[1] != undefined) {
                    options.handleOption(devCommand, devResponse, message.attachments.array());
                    return message.channel.send(
                        `Edited auto-reply: ${'`' + devCommand + '`'}, ${devResponse ? ("with the response: \n> " + devResponse) : "with the attachment: \n>"}.`,
                        { files: message.attachments.array() }
                    );
                }
                return message.reply(`Auto-reply for ${'`' + devCommand + '`'} doesn't exist.`);
            } catch (err) {
                return message.reply(err)
            }
        } else if (command === 'setRole') {
            if (args.length < 1) {
                return message.reply(`Correct Usage: ${prefix}setRole roleID.`);
            }
            let newRole = args.shift();
            options.handleBaseOptionOrAlias('roleID', newRole);
            return message.reply(`Changed roleID to ${newRole}`);
        } else if (command === 'list') {
            return message.reply(options.getList());
        } else if (command === 'alias') {
            if (args.length < 2) {
                return message.reply(`Correct Usage: ${prefix}alias !help help.\nor: "not found" file not found`);
            }
            try {
                const [devAlias, devExistingCMD] = commandParser(message.content);
                if (["prefix", "roleID"].includes(devAlias)) return message.reply(`Can not alias base value ${devAlias} as a command.`)
                if (["prefix", "roleID"].includes(devExistingCMD)) return message.reply(`Can not alias base value ${devExistingCMD} as a target.`)
                if (options.getOption(devExistingCMD)[1] === undefined) return message.reply(`Can not target alias for ${'`' + devExistingCMD + '`'} it doesn't exist.`);
                if (options.getOption(devAlias)[1] !== undefined) return message.reply(`Can not alias ${devAlias} as it already exists remove it first.`)

                options.handleBaseOptionOrAlias(devAlias, devExistingCMD);
                return message.channel.send(`Added alias ${devAlias} => ${devExistingCMD}`);
            } catch (err) {
                return message.reply(err)
            }
        } else if (command === 'rename') {
            if (args.length < 2) {
                return message.reply(`Correct Usage: ${prefix}rename !help help.\nor: "not found" file not found`);
            }
            try {
                const [devCurrent, devRename] = commandParser(message.content);
                if (["prefix", "roleID"].includes(devCurrent)) return message.reply(`Can not rename base value ${devCurrent}.`)
                if (["prefix", "roleID"].includes(devRename)) return message.reply(`Can not rename to base value ${devRename}.`)
                if (options.getOption(devCurrent)[1] === undefined) return message.reply(`Can not rename ${'`' + devCurrent + '`'} it doesn't exist.`);
                if (options.getOption(devRename)[1] !== undefined) return message.reply(`Can not rename to ${'`' + devRename + '`'} it already exists.`);

                options.rePointAliases(devCurrent, devRename);
                delete Object.assign(options, { [devRename]: options[devCurrent] })[devCurrent];
            } catch (err) {
                return message.reply(err)
            }
        }
    }
}

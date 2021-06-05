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
    private recentlySentReply: { [id: string]: number } = {};

    private poller: NodeJS.Timeout;

    init(): void {
        this.poller = setInterval(() => {
            this.recentlySentReply = {};
        }, 3000);
    }

    stop(): void {
        this.poller = undefined;
    }

    //message should be type of Message from discord but that way typescript throws error on line 8
    public async handleMessage(message: Message): Promise<Message> {
        //check for auto-response and if found dont continue
        if (channels.includes(message.channel.id)) {
            const messageOptions = options.getOption(message.content)
            if (messageOptions) {
                if (this.recentlySentReply === undefined) {
                    this.recentlySentReply = {}; // not sure why undefined here. should already defined 🤔
                }

                this.recentlySentReply[message.author.id] = (this.recentlySentReply[message.author.id] ?? -1) + 1;

                if (
                    this.recentlySentReply[message.author.id] !== undefined &&
                    this.recentlySentReply[message.author.id] > 2
                ) {
                    return message.reply(`Bruh stop spamming :prettypepepuke:`);
                }
                message.reply(messageOptions);
                return;
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
                const autoresponses = Object.assign({}, options.currentOptions);
                delete autoresponses.prefix;
                delete autoresponses.roleID;

                if (this.recentlySentReply === undefined) {
                    this.recentlySentReply = {}; // not sure why undefined here. should already defined 🤔
                }

                this.recentlySentReply[message.author.id] = (this.recentlySentReply[message.author.id] ?? -1) + 1;

                if (
                    this.recentlySentReply[message.author.id] !== undefined &&
                    this.recentlySentReply[message.author.id] > 2
                ) {
                    return message.reply(`Bruh stop spamming :prettypepepuke:`);
                }

                return message.reply(
                    `Here's a list of available auto-response keywords:\n- ${Object.keys(autoresponses).join('\n- ')}`
                );
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
            options.handleOption(command, newPrefix);
            return message.reply(`Changed prefix from ${prefix} to ${newPrefix}`);
        } else if (command === 'add') {
            if (args.length < 2 && !message.attachments.first()) {
                return message.reply(`Correct Usage: ${prefix}add command response.`);
            }
            try {
                const [devCommand, devResponse] = commandParser(message.content);
                if (["prefix", "roleID"].includes(devCommand)) return message.reply(`Can not add base value ${devCommand} as a command.`)
                if (options.currentOptions[devCommand] != undefined) {
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
            options.deleteCommand(delCommand);
            return message.reply(`Deleted auto-reply for ${'`' + delCommand + '`'}`);
        } else if (command === 'edit') {
            //check for missing arguments cause people dumb
            if (args.length < 2 && !message.attachments.first()) {
                return message.reply(`Correct Usage: ${prefix}edit command newResponse.`);
            }
            try {
                const [devCommand, devResponse] = commandParser(message.content);
                if (["prefix", "roleID"].includes(devCommand)) return message.reply(`Can not add base value ${devCommand} as a command.`)
                if (options.currentOptions[devCommand] != undefined) {
                    options.handleOption(devCommand, devResponse, message.attachments.array());
                    return message.channel.send(
                        `Added auto-reply: ${'`' + devCommand + '`'}, ${devResponse ? ("with the response: \n> " + devResponse) : "with the attachment: \n>"}.`,
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
            options.handleOption('roleID', newRole);
            return message.reply(`Changed roleID to ${newRole}`);
        } else if (command === 'list') {
            const autoresponses = Object.assign({}, options.currentOptions);
            delete autoresponses.prefix;
            delete autoresponses.roleID;

            return message.reply(
                `Here's a list of available auto-response keywords:\n- ${Object.keys(autoresponses).join('\n- ')}`
            );
        }
    }
}

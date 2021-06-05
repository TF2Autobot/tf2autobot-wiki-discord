import { options } from '../app';
import { Message } from 'discord.js';
const channels = JSON.parse(process.env.CHANNEL_IDS) as string[];

export default class Commands {
    //message should be type of Message from discord but that way typescript throws error on line 8
    public async handleMessage(message: Message): Promise<Message> {
        //check for auto-response and if found dont continue
        if (channels.includes(message.channel.id)) {
            if (options.currentOptions[message.content] != undefined) {
                message.reply(options.currentOptions[message.content]);
                return;
            }
        }

        //dont continue if doesnt start with prefix or is an other bot
        const prefix = options.currentOptions.prefix;
        const roleID = options.currentOptions.roleID;
        if (!message.content.startsWith(prefix) || message.author.bot) {
            return;
        }

        const isOwner = message.guild.ownerID === message.author.id;
        if (!message.member.roles.cache.some(r => r.id == roleID) && !isOwner) {
            return;
        }

        //check if its on correct channel
        if (!channels.includes(message.channel.id)) {
            return message.reply(`Any commands should be run on ${channels.map(channel => `<#${channel}`).join(', ')}`);
        }

        //get arguments and command
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().trim();

        if (command === 'prefix') {
            //check for missing arguments cause people dumb
            if (args.length < 1) {
                return message.reply(`Correct Usage: ${prefix}prefix newPrefix.`);
            }
            let newPrefix = args.shift();
            options.handleOption(command, newPrefix);
            return message.reply(`Changed prefix from ${prefix} to ${newPrefix}`);
        } else if (command === 'add') {
            if (args.length < 2) {
                return message.reply(`Correct Usage: ${prefix}add command response.`);
            }
            let command = args[0];
            if (options.currentOptions[command] != undefined) {
                return message.reply(`Auto-reply for ${'`' + command + '`'} already exists.`);
            }
            let response = args.slice(1).join(' ');
            options.handleOption(command, response);
            return message.channel.send(
                `Added auto-reply: ${'`' + command + '`'}, with the response: \n> ${response}.`
            );
        } else if (command === 'remove') {
            //check for missing arguments cause people dumb
            if (args.length < 1) {
                return message.reply(`Correct Usage: ${prefix}remove command.`);
            }
            let delCommand = args.shift();
            options.deleteCommand(delCommand);
            return message.reply(`Deleted auto-reply for ${'`' + delCommand + '`'}`);
        } else if (command === 'edit') {
            //check for missing arguments cause people dumb
            if (args.length < 2) {
                return message.reply(`Correct Usage: ${prefix}edit command newResponse.`);
            }
            let command = args[0];
            if (options.currentOptions[command] != undefined) {
                let newResponse = args.slice(1).join(' ');
                options.handleOption(command, newResponse);
                return message.reply(`Modified response for ${'`' + command + '`'}.`);
            }
            return message.reply(`Auto-reply for ${'`' + command + '`'} doesn't exist.`);
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

            return message.reply(`Here's a list of available auto-response keywords:\n -${Object.keys(autoresponses).join('\n -')}`);
        }
    }
}

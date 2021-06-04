import {options} from '../app'
export default class Commands {

    //message should be type of Message from discord but that way typescript throws error on line 8
    public async handleMessage(message) : Promise<void> {
        //check for auto-response and if found dont continue
        if(message.channel.name.toLowerCase() === 'help-english') {
            if(options.currentOptions[message.content] != undefined) {
                message.reply(options.currentOptions[message.content]);
                return;
            }
        }
        
        //dont continue if doesnt start with prefix or is an other bot
        let prefix = options.currentOptions.prefix
        let roleID = options.currentOptions.roleID
        if(!message.content.startsWith(prefix) || message.author.bot) {
            return;
        }

        let isOwner = message.guild.ownerID === message.author.id;
        if(!message.member.roles.cache.some(r => r.id == roleID) && !isOwner) {
            return;
        }

        //check if its on correct channel
        if(message.channel.name.toLowerCase() != 'help-english') {
            let helpID = message.guild.channels.cache.find(channel => channel.name === "help-english");
            return message.reply(`Any commands should be run on ${helpID}`);
        }

        //get arguments and command
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().trim();
        
        if(command === "prefix") {
            //check for missing arguments cause people dumb
            if(args.length < 1) {
                return message.reply(`Correct Usage: ${prefix}prefix newPrefix.`);
            }
            let newPrefix = args.shift();
            options.handleOption(command,newPrefix);
            return message.reply(`Changed prefix from ${prefix} to ${newPrefix}`);
        } else if(command === "add") {
            if(args.length < 2) {
                return message.reply(`Correct Usage: ${prefix}add command response.`);
            }
            let command = args[0];
            if(options.currentOptions[command] != undefined) {
                return message.reply(`Auto-reply for ${'`' + command + '`'} already exists.`);
            }
            let response = args.slice(1).join(' ');
            options.handleOption(command,response);
            return message.channel.send(`Added auto-reply: ${'`' + command + '`'}, with the response: \n> ${response}.`);
            
            
        } else if(command === "remove") {
            //check for missing arguments cause people dumb
            if(args.length < 1) {
                return message.reply(`Correct Usage: ${prefix}remove command.`);
            }
            let delCommand = args.shift();
            options.deleteCommand(delCommand);
            return message.reply(`Deleted auto-reply for ${'`' + delCommand + '`'}`);
        } else if(command === "edit") {
            //check for missing arguments cause people dumb
            if(args.length < 2) {
                return message.reply(`Correct Usage: ${prefix}edit command newResponse.`);
            }
            let command = args[0];
            if(options.currentOptions[command] != undefined) {
                let newResponse = args.slice(1).join(' ');
                options.handleOption(command, newResponse);
                return message.reply(`Modified response for ${'`' + command + '`'}.`);
            }
            return message.reply(`Auto-reply for ${'`' + command + '`'} doesn't exist.`);
        } else if(command === "setRole") {
            if(args.length < 1) {
                return message.reply(`Correct Usage: ${prefix}setRole roleID.`);
            }
            let newRole = args.shift();
            options.handleOption("roleID", newRole);
            return message.reply(`Changed roleID to ${newRole}`);
        }
    }
}
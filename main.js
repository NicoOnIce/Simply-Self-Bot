const { Client } = require("discord.js-selfbot-v13");
const client = new Client();
const config = require("./config.json");
const axios = require("axios")
const fs = require('fs');

const protobuf = require("protobufjs");

var upTime = [0, 0, 0]
var autoReacts = {
    "userId": "emoji"
}

var afkStatus = {
    "afk": false,
    "reason": null,
    "time": [0, 0, 0],
    "preivousUsername": ""
}

const TOKEN = config["token"];
var prefix = config["prefix"]
var apiKey = config["apiKey"]
var statuses = config["statuses"]
var rotateStatus = config["rotateStatus"]

function writeNewConfig() {
    const newJsonData = {
        "token": TOKEN,
        "prefix": prefix,
        "defaultAfk": null,
        "apiKey": apiKey,
        "statuses": statuses,
        "rotateStatus": rotateStatus
    }

    fs.writeFile('config.json', JSON.stringify(newJsonData, null, 2), 'utf8', (err) => {
        if (err) {
            console.error("Error writing to file", err);
        } else {
            console.log("JSON file has been saved.");
        }
    });
}

async function getResponse(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const data = {
        contents: [{ parts: [{ text: `${prompt}.` }] }]
    };

    try {
        const response = await axios.post(url, data, {
            headers: { "Content-Type": "application/json" }
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching response:", error.response ? error.response.data : error.message);
        return null;
    }
}

async function changeStatus(settings) {
    const url = `https://discord.com/api/v9/users/@me/settings-proto/1`;
    const data = {
        settings: settings
    };

    try {
        const response = await axios.patch(url, data, {
            headers: { "Content-Type": "application/json", "Authorization": TOKEN }
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching response:", error.response ? error.response.data : error.message);
        return null;
    }
}

function timeKeeper() {
    if (afkStatus["afk"]) {
        if (afkStatus["time"][2]+1 == 60) {
            afkStatus["time"] = [afkStatus["time"][0], afkStatus["time"][1]+1, 0]
        } else {
            afkStatus["time"] = [afkStatus["time"][0], afkStatus["time"][1], afkStatus["time"][2]+1]
        }
        
        if (afkStatus["time"][1] == 60) {
            afkStatus["time"] = [afkStatus["time"][0]+1, 0, 0]
        }
    }

    if (upTime[2]+1 == 60) {
        upTime = [upTime[0], upTime[1]+1, 0]
    } else {
        upTime = [upTime[0], upTime[1], upTime[2]+1]
    }
    
    if (upTime[1] == 60) {
        upTime = [upTime[0]+1, 0, 0]
    }
}

async function isReplyingTo(message, userId) {
  if (message.author.id === client.user.id) return;

  if (message.reference && message.reference.messageId) {
    try {
      const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);

      if (repliedMessage.author.id === userId) {
        return true;
      }
    } catch (error) {
       //console.error('Failed to fetch replied message:', error);
      return false;
    }
  }

  return false;
}

setInterval(() => {
    timeKeeper()
}, 1000);

client.on("ready", () => {
  console.log(`[Ready] Bot is now online.`);

  afkStatus["preivousUsername"] = client.user.globalName

    let statusPlace = 0

  setInterval(async () => {
    if (rotateStatus && !afkStatus["afk"]) {
        if (statusPlace > statuses.length-1) {statusPlace = 0}

        await changeStatus(statuses[statusPlace])
        console.log(`[StatusRotator] Rotated status to position ${statusPlace} in statuses`)
        statusPlace += 1
    }
  }, 15000);
});

client.on("messageCreate", async (message) => {
  if (message.author.id !== client.user.id) {
    if (afkStatus["afk"] && message.channel.type == "DM" || afkStatus["afk"] && message.content.includes(`<@${client.user.id}>`) || afkStatus["afk"] && await isReplyingTo(message, client.user.id)) {
        try {
            message.reply(`<@${client.user.id}> is currently afk.\nReason: ${afkStatus["reason"]}\nThey have been afk for: ${afkStatus["time"][0]} hours ${afkStatus["time"][1]} minutes ${afkStatus["time"][2]} seconds`)
        } catch (e) {
            console.log(`[Error] Ran into a error while sending afk message to ${message.author.username} (${message.author.id})\n[Error] Error: ${e}`)
        }
    }

    if (message.author.id in autoReacts) {
        message.react(autoReacts[message.author.id])
    }

    return;
  }


  let args = message.content.split(" ")

  if (message.content === "$>lifeCheck") {
    message.reply("I am alive! Hello world.");
  }

  if (args[0] == prefix+"echo") {
    args.shift()
    message.reply(args.join(" "))
  }

  if (args[0] == prefix+"afk") {
        args.shift()

    if (afkStatus["afk"]) {
        message.reply(`${client.user.globalName} has come back from being afk.`)
        // not working, needs captcha solver
        //client.user.setGlobalName(afkStatus["preivousUsername"])

        afkStatus = {
            "afk": false,
            "reason": null,
            "time": [0, 0, 0],
            "preivousUsername": client.user.username
        }

        //client.user.setStatus("online")

        changeStatus("WjQKCAoGb25saW5lEiYKFWxpZmUgaXMgYSBmZXZlciBkcmVhbRoE8J+UpSkuyKhUlgEAABoA")

        return;
    }

    message.reply(`${client.user.globalName} has went afk.\nReason: ${args.join(" ")}`)

    afkStatus["afk"] = true
    afkStatus["reason"] = args.join(" ")

    //client.user.setStatus("idle")
    // not working, needs captcha solver
    //client.user.setGlobalName(afkStatus["preivousUsername"]+" [AFK]")

    changeStatus("WiwKCAoGb25saW5lEh4KDUN1cnJlbnRseSBBRksaBPCfmLQpGBAi4pUBAAAaAA==")
  }

  if (args[0] == prefix+"upTime") {
    message.reply(`${upTime[0]} Hours ${upTime[1]} Minutes ${upTime[2]} Seconds`)
  }

  if (args[0] == prefix+"generate") {
    args.shift()
    const prompt = args.join(" ")

    async function finishReply() {
        const resp = await getResponse(prompt)
        const textResponse = resp.candidates[0].content.parts[0].text

        message.reply(textResponse)
    }

    finishReply()
  }

  if (args[0] == prefix+"config") {
    args.shift()

    if (args[1] == "prefix") {
        prefix = args[1]
        writeNewConfig()

        if (args[3] && (args[3] == "-s")) {
            message.delete()
            return;
        }

        message.reply("[Variables] Prefix has been changed globaly")
        return;
    }

    if (args[1] == "status") {
        let output = ""

        if (args[2] == "remove") {
            if (args[3]) {
                statuses.pop(args[3])
            } else {
                args[-1]
                output = "[Variables] Removed latest added status from rotation"
            }
        } else if (args[2] == "append") {
            if (args[3]) {
                statuses.push(args[3])
                output = `[Variables] Added new status to rotation (${args[3]})`
            } else {
                output = "[Error] No status string passed (argument 3)"
            }
        } else {
            output = "[Error] No determining string passed (argument 2)"
        }

        writeNewConfig()

        if (args[-1] == "-s") {
            message.delete();
            return;
        }

        if (output != "") {
            message.reply(output);
            return;
        }
    }
  }

  if (args[0].toLowerCase() == prefix+"autoreact") {
    if (args[1] && args[2]) {
        let response = false
        if (args[1] in autoReacts) {
            response = true
            delete autoReacts[args[1]]
        }
        autoReacts[args[1]] = args[2]

        if (args[3] && (args[3] == "-s")) {
            message.delete()
            return;
        }

        if (response) {
            message.reply(`[AutoReact] No longer AutoReacting (${args[2]}) to all message by: ${args[1]}`)
            return;
        } else {
            message.reply(`[AutoReact] AutoReacting (${args[2]}) to all message by: ${args[1]}`)
            return;
        }
    }
  }

  if (args[0].toLowerCase() == prefix+"addstatus") {
    const root = await protobuf.load("settings.proto");
    const StatusSettings = root.lookupType("StatusSettings");

    const payload = {
        status: args[1],
        custom_status: {
          text: "No text given",
          emoji_name: args[2],
        },
    };

    payload.custom_status.text = args.slice(3).join(" ") || "No text given";

    console.log(payload)
    
    const err = StatusSettings.verify(payload);
    if (err) throw Error(err);

    const messagee = StatusSettings.create(payload);
    const buffer = StatusSettings.encode(messagee).finish();
    const base64 = buffer.toString("base64");

    message.reply(`[Statuses] Added new status (${base64})`)
  }

  if (args[0].toLowerCase() == prefix+"rotatestatus") {
    rotateStatus = !rotateStatus
    writeNewConfig()

    if (args[-1] == "-s") {
        message.delete()
        return;
    }

    message.reply(`[StatusRotator] New toggle: ${rotateStatus}`)
  }
});

client.login(TOKEN);

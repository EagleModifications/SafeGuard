const Table = require("cli-table3");
const botStatus = require('../utils/botStatus');

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);

    // Log commands
    const commandTable = new Table({
      head: [("Command"), ("Status")],
      colWidths: [30, 15],
    });

    client.commands.forEach(cmd => {
      commandTable.push([cmd.data.name, ("Loaded")]);
    });

    console.log("\n📦 Commands Loaded:");
    console.log(commandTable.toString());

    // Log events
    const eventTable = new Table({
      head: [("Event"), ("Status")],
      colWidths: [30, 15],
    });

    client.eventNames().forEach(event => {
      eventTable.push([event, ("Bound")]);
    });

    console.log("\n⚡ Events Loaded:");
    console.log(eventTable.toString());

    console.log(`\n🤖 Ready! Logged in as ${client.user.tag}`);

    let statusMessages;

    statusMessages = await botStatus(client);

    const guildCount = client.guilds.cache.size;

    let totalMembers = 0;
    client.guilds.cache.forEach(guild => {
      totalMembers += guild.memberCount; // guild.memberCount gives number of members in that guild
    });


    const statuses = ["Watching Over SafeGuard", "Watching /help", `${guildCount} Servers, with ${totalMembers} Members`];
    let i = 0;

    setInterval(() => {
      client.user.setPresence({
        activities: [{ name: statuses[i % statuses.length], type: 3 }],
        status: 'online'
      });
      i++;
    }, 5000);
  }
};

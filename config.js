module.exports = {
  app_title: 'Place Reloaded',
  database: 'mongodb://localhost/place',
  port: 3000,
  salt_length: 64,
  enable_restrictions: true, // Enable in-game restricted area/creation
  allow_restriction_intersect: false, // Whether restrictions can intersect each other or not
  cooldown: 15, // Cooldown between player places in seconds
  cooldown_chat: 500, // Cooldown between chat messages in milliseconds
  connect_cooldown: false, // Apply the default cooldown on connect
  width: 1250,
  height: 1250,
  allow_custom_colors: true,
  clearColor: 0xFFFFFFFF,
  palette: ["#FFFFFF", "#DAD45E", "#6DC2CA", "#D2AA99", "#6DAA2C", "#8595A1", "#D27D2C", "#597DCE", "#757161", "#D04648", "#346524", "#854C30", "#4E4A4F", "#30346D", "#442434", "#140C1C"],
};

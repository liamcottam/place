window.ModTools = {
  init: function () {
    this.initSpamBlocks();
    this.initContextMenu();

    App.alert('Moderation tools loaded');
    setTimeout(function () {
      App.alert(null);
    }.bind(this), 5000);
  },
  initSpamBlocks: function () {
    var x = -1;
    var y = -1;
    var spamBlocksEnabled = false;
    App.elements.board.on("mousemove", function (evt) {
      var boardPos = App.screenToBoardSpace(evt.clientX, evt.clientY);
      var diff = false;
      if (x != boardPos.x) {
        diff = true;
        x = boardPos.x;
      }

      if (y != boardPos.y) {
        diff = true;
        y = boardPos.y;
      }

      if (diff && spamBlocksEnabled) {
        App.place(x, y);
      }
    });

    $(document).on("mousedown", function (evt) {
      if (evt.which == 2) {
        spamBlocksEnabled = !spamBlocksEnabled;
        $('.spam-enabled').text('Spam Enabled: ' + spamBlocksEnabled);
        evt.preventDefault();
      }
    });

    $('.bubble-container').empty();
    $('<div>', { "class": 'bubble spam-enabled' }).text('Spam Enabled: false').appendTo('.bubble-container');
  },
  initContextMenu: function () {
    $.contextMenu('destroy');
    $.contextMenu({
      selector: '.username',
      trigger: 'right',
      zIndex: 1000,
      items: {
        spectate: {
          name: 'Spectate',
          callback: function (itemKey, opt) {
            App.spectate(opt.$trigger.text());
          }
        },
        sep1: '',
        cooldown: {
          name: 'Cooldown',
          callback: function (itemKey, opt) {
            App.socket.send(JSON.stringify({
              type: 'cooldown',
              session_id: opt.$trigger.text(),
            }));
          }
        },
      }
    });
  }
}

ModTools.init();



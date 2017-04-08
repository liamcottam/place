window.ModTools = {
  elements: {
    bubbleContainer: $('.bubble-container'),
    spamEnabledDiv: $('<div>', { class: 'bubble' }).text('Spam Enabled: false'),
    restrictionDiv: $('<div>', { class: 'bubble' }).text('Create Restriction'),
    restrictionBackDiv: $('<div>', { class: 'bubble' }).text('Exit Selection Mode'),

    startSelection: $('<div>', { class: 'bubble', text: 'Start Position', style: 'cursor: pointer;' }),
    endSelection: $('<div>', { class: 'bubble', text: 'End Position', style: 'cursor: pointer;' }),
    permaReticule: $('<div>', { class: 'reticule' }).hide(),
    restrictSelection: $('<div>', { class: 'bubble', text: 'Restrict Selection', style: 'cursor: pointer;' }).hide(),

    selectionBorder: $('<div>', { class: 'selection' }),
  },
  init: function () {
    this.reset();

    this.initContextMenu();
    this.initSpamBlocks();
    this.initPermaReticule();
    this.initSelectionMode();


    App.alert('Moderation tools loaded');
    setTimeout(function () {
      App.alert(null);
    }.bind(this), 5000);
  },
  reset: function () {
    this.spamBlocksEnabled = false;
    this.selectionModeEnabled = false;
    this.startSelection = null;
    this.endSelection = null;

    this.elements.startSelection.text('Start Position');
    this.elements.endSelection.text('End Position');
    this.elements.restrictSelection.hide();

    this.initBubbles();
    this.initRestrictions();

    App.switchColor(-1);

    App.elements.palette.show();
    this.elements.permaReticule.hide();
  },
  initPermaReticule: function () {
    $('.ui').append(this.elements.permaReticule);

    App.elements.board.on("mousemove", function (evt) {
      var boardPos = App.screenToBoardSpace(evt.clientX, evt.clientY);
      boardPos.x |= 0;
      boardPos.y |= 0;

      var screenPos = App.boardToScreenSpace(boardPos.x, boardPos.y);
      this.elements.permaReticule.css("transform", "translate(" + screenPos.x + "px, " + screenPos.y + "px)");
      this.elements.permaReticule.css("width", App.scale + "px").css("height", App.scale + "px");
    }.bind(this));
  },
  initSelectionMode: function () {
    $('.ui').append(this.elements.selectionBorder);

    App.elements.board.on("mousemove", function (evt) {
      if (this.selectionModeEnabled && this.startSelection !== null && this.endSelection !== null) {
        var scaleX = (this.endSelection.x - (this.startSelection.x - 1)) * App.scale;
        var scaleY = (this.endSelection.y - (this.startSelection.y - 1)) * App.scale;

        var screenPos = App.boardToScreenSpace(this.startSelection.x, this.startSelection.y);
        this.elements.selectionBorder.css("transform", "translate(" + screenPos.x + "px, " + screenPos.y + "px)");
        this.elements.selectionBorder.css("width", scaleX + "px").css("height", scaleY + "px");
        this.elements.selectionBorder.show();
      } else {
        this.elements.selectionBorder.hide();
      }
    }.bind(this));

    App.elements.boardContainer.on('mousedown', function (evt) {
      downX = evt.clientX;
      downY = evt.clientY;
    }).on('click', function (evt) {
      if (this.selectionModeEnabled && downX === evt.clientX && downY === evt.clientY) {
        if (this.startSelection === null) {
          this.startSelection = App.screenToBoardSpace(evt.clientX, evt.clientY);
          this.elements.startSelection.text('Start: (' + this.startSelection.x + ', ' + this.startSelection.y + ')');
        } else {
          this.endSelection = App.screenToBoardSpace(evt.clientX, evt.clientY);
          this.elements.endSelection.text('End: (' + this.endSelection.x + ', ' + this.endSelection.y + ')');
        }

        if (this.startSelection !== null && this.endSelection !== null) {
          this.elements.restrictSelection.show();
        }
      }
    }.bind(this));
  },
  initBubbles: function () {
    this.elements.bubbleContainer.empty();
    this.elements.bubbleContainer.append(this.elements.spamEnabledDiv);
    this.elements.bubbleContainer.append(this.elements.restrictionDiv);
  },
  initSpamBlocks: function () {
    var x = -1;
    var y = -1;
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

      if (diff && this.spamBlocksEnabled) {
        App.place(x, y);
      }
    }.bind(this));

    $(document).on("mousedown", function (evt) {
      if (evt.which == 2) {
        this.spamBlocksEnabled = !this.spamBlocksEnabled;
        this.elements.spamEnabledDiv.text('Spam Enabled: ' + this.spamBlocksEnabled);
        if (x !== -1 && y !== -1) {
          App.place(x, y);
        }
        evt.preventDefault();
      }
    }.bind(this));
  },
  initRestrictions: function () {
    this.elements.restrictionDiv.click(function () {
      this.reset();
      App.elements.palette.hide();
      this.elements.permaReticule.show();
      this.elements.bubbleContainer.empty();
      this.elements.bubbleContainer.append(this.elements.restrictionBackDiv);
      this.elements.bubbleContainer.append(this.elements.startSelection);
      this.elements.bubbleContainer.append(this.elements.endSelection);
      this.elements.bubbleContainer.append(this.elements.restrictSelection);

      this.elements.startSelection.click(function () {
        this.startSelection = null;
        this.elements.startSelection.text('Start Position');
        this.elements.restrictSelection.hide();
      }.bind(this));
      this.elements.restrictSelection.click(this.restrictSelection.bind(this));
      this.selectionModeEnabled = true;
    }.bind(this));

    this.elements.restrictionBackDiv.click(function () {
      this.reset();
    }.bind(this));
  },
  restrictSelection: function () {
    App.socket.send(JSON.stringify({
      type: 'restriction',
      start: this.startSelection,
      end: this.endSelection
    }));

    this.reset();
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
        ban: {
          name: 'Ban',
          callback: function (itemKey, opt) {
            App.socket.send(JSON.stringify({
              type: 'ban',
              session_id: opt.$trigger.text(),
            }));
          }
        },
      }
    });
  }
}

ModTools.init();



window.ModTools = {
  elements: {
    bubbleContainer: $('.bubble-container'),
    spamEnabledDiv: $('<div>', { class: 'bubble' }).text('Spam Enabled: false'),
    restrictedToggle: $('<div>', { class: 'bubble restricted-toggle' }).text('Show Restricted Areas'),
    permaReticule: $('<div>', { class: 'reticule' }).hide(),

    restrictionDiv: $('<div>', { class: 'bubble' }).text('Create Restriction'),

    exitSelectionMode: $('<div>', { class: 'bubble' }).text('Exit Selection Mode'),
    startSelection: $('<div>', { class: 'bubble', text: 'Start Position' }),
    endSelection: $('<div>', { class: 'bubble', text: 'End Position' }),
    confirmSelection: $('<div>', { class: 'bubble', text: 'Confirm Selection' }).hide(),
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
    }.bind(this), 1500);
  },
  reset: function () {
    this.spamBlocksEnabled = false;
    this.selectionModeEnabled = false;
    this.manualStart = false;
    this.manualEnd = false;
    this.startSelection = null;
    this.endSelection = null;

    this.elements.spamEnabledDiv.text('Spam Enabled: false');
    this.elements.startSelection.text('Start Position');
    this.elements.endSelection.text('End Position');
    this.elements.confirmSelection.hide();

    this.initBubbles();
    this.initCreateRestriction();
    this.onTransform();
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

    App.elements.board.on('mousemove', this.onTransform.bind(this));
    App.elements.boardContainer.on('wheel', this.onTransform.bind(this));

    App.elements.boardContainer.on('mousedown', function (evt) {
      downX = evt.clientX;
      downY = evt.clientY;
    }).on('click', function (evt) {
      if (this.selectionModeEnabled && downX === evt.clientX && downY === evt.clientY) {
        if (this.startSelection === null && !this.manualEnd || this.manualStart) {

          var temp = App.screenToBoardSpace(evt.clientX, evt.clientY);
          if (this.endSelection !== null && (temp.x > this.endSelection.x || temp.y > this.endSelection.y)) {
            this.manualStart = false;
            this.endSelection = temp;
            this.elements.endSelection.text('Start: (' + this.endSelection.x + ', ' + this.endSelection.y + ')');
            return;
          } else {
            this.startSelection = temp;
          }

          this.elements.startSelection.text('Start: (' + this.startSelection.x + ', ' + this.startSelection.y + ')');
        } else {

          var temp = App.screenToBoardSpace(evt.clientX, evt.clientY);
          if (temp.x < this.startSelection.x || temp.y < this.startSelection.y) {
            this.manualStart = true;
            this.startSelection = temp;
            this.elements.startSelection.text('Start: (' + this.startSelection.x + ', ' + this.startSelection.y + ')');
            return;
          } else {
            this.endSelection = temp;
          }

          this.elements.endSelection.text('End: (' + this.endSelection.x + ', ' + this.endSelection.y + ')');

          if (this.startSelection === null && this.manualEnd) {
            this.manualEnd = false;
            this.manualStart = true;
          }
        }

        if (this.startSelection !== null && this.endSelection !== null) {
          this.elements.confirmSelection.show();
        }
      }
    }.bind(this));
  },
  onTransform: function () {
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
  },
  initBubbles: function () {
    this.elements.bubbleContainer.empty();
    this.elements.bubbleContainer.append(this.elements.spamEnabledDiv);
    //this.elements.bubbleContainer.append(this.elements.restrictionDiv);

    //App.elements.restrictedToggle = this.elements.restrictedToggle;
    //this.elements.bubbleContainer.append(this.elements.restrictedToggle);
    //this.elements.restrictedToggle.click(App.restrictedAreaToggle.bind(App));
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
  initCreateRestriction: function () {
    this.elements.restrictionDiv.click(function () {
      this.startSelectionMode(function (start, end) {
        this.restrictSelection(start, end);
      }.bind(this));
    }.bind(this));
  },
  startSelectionMode: function (callback) {
    this.reset();
    App.elements.palette.hide();
    this.elements.permaReticule.show();
    this.elements.bubbleContainer.empty();
    this.elements.bubbleContainer.append(this.elements.exitSelectionMode);
    this.elements.bubbleContainer.append(this.elements.startSelection);
    this.elements.bubbleContainer.append(this.elements.endSelection);
    this.elements.bubbleContainer.append(this.elements.confirmSelection);

    this.elements.startSelection.click(function () {
      this.elements.startSelection.text('Start Position');
      this.manualStart = true;
      this.elements.confirmSelection.hide();
    }.bind(this));

    this.elements.endSelection.click(function () {
      this.manualStart = false;
      this.manualEnd = true;
    }.bind(this));

    this.elements.exitSelectionMode.click(function () {
      this.reset();
    }.bind(this));

    this.elements.confirmSelection.click(function () {
      callback(this.startSelection, this.endSelection);
      this.reset();
    }.bind(this));

    this.selectionModeEnabled = true;
  },
  restrictSelection: function (start, end) {
    App.socket.send(JSON.stringify({
      type: 'restriction',
      start: start,
      end: end
    }));

    this.reset();
  },
  initContextMenu: function () {
    $.contextMenu('destroy');
    var triggers = ['right', 'left'];
    triggers.forEach(function (trigger) {
      $.contextMenu({
        selector: '.username',
        trigger: trigger,
        zIndex: 1000,
        autoHide: true,
        items: {
          spectate: {
            name: 'Spectate',
            callback: function (itemKey, opt) {
              App.spectate(opt.$trigger.text());
            }
          },
          mention: {
            name: 'Mention',
            callback: function (itemKey, opt) {
              App.mention(opt.$trigger.text());
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
    });
  }
}

ModTools.init();



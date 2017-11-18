window.ModTools = {
  elements: {
    bubbleContainer: $('.bubble-container'),
    screenshotDiv: $('<div>', { class: 'bubble' }).append($('<a>', { id: 'download', onclick: 'App.toURL()' }).text('Screenshot')),
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
  enableRestrictions: false,
  init() {
    if ($('.restricted-toggle').length) {
      this.enableRestrictions = true;
    }
    this.reset();

    this.initContextMenu();
    this.initSpamBlocks();
    this.initPermaReticule();
    this.initSelectionMode();

    App.alert('Moderation tools loaded');
    setTimeout(
      () => {
        App.alert(null);
      },
      1500,
    );
  },
  reset() {
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
    App.switchColor(null);

    App.elements.palette.show();
    this.elements.permaReticule.hide();
  },
  initPermaReticule() {
    $('.ui').append(this.elements.permaReticule);
    const retFn = function (evt) {
      const boardPos = App.screenToBoardSpace(evt.clientX, evt.clientY);
      boardPos.x |= 0;
      boardPos.y |= 0;

      const screenPos = App.boardToScreenSpace(boardPos.x, boardPos.y);
      this.elements.permaReticule.css(
        'transform',
        `translate(${screenPos.x}px, ${screenPos.y}px)`,
      );
      this.elements.permaReticule.css('width', `${App.scale}px`).css('height', `${App.scale}px`);
    };

    App.elements.board.on('wheel', retFn.bind(this));
    App.elements.board.on('mousemove', retFn.bind(this));
  },
  initSelectionMode() {
    $('.ui').append(this.elements.selectionBorder);

    App.elements.board.on('mousemove', this.onTransform.bind(this));
    App.elements.boardContainer.on('wheel', this.onTransform.bind(this));

    App.elements.boardContainer
      .on('mousedown', (evt) => {
        downX = evt.clientX;
        downY = evt.clientY;
      })
      .on(
        'click',
        (evt) => {
          if (this.selectionModeEnabled && downX === evt.clientX && downY === evt.clientY) {
            if ((this.startSelection === null && !this.manualEnd) || this.manualStart) {
              var temp = App.screenToBoardSpace(evt.clientX, evt.clientY);
              if (
                this.endSelection !== null &&
                (temp.x > this.endSelection.x || temp.y > this.endSelection.y)
              ) {
                this.manualStart = false;
                this.endSelection = temp;
                this.elements.endSelection.text(`Start: (${this.endSelection.x}, ${this.endSelection.y})`);
                return;
              }
              this.startSelection = temp;


              this.elements.startSelection.text(`Start: (${this.startSelection.x}, ${this.startSelection.y})`);
            } else {
              var temp = App.screenToBoardSpace(evt.clientX, evt.clientY);
              if (temp.x < this.startSelection.x || temp.y < this.startSelection.y) {
                this.manualStart = true;
                this.startSelection = temp;
                this.elements.startSelection.text(`Start: (${this.startSelection.x}, ${this.startSelection.y})`);
                return;
              }
              this.endSelection = temp;


              this.elements.endSelection.text(`End: (${this.endSelection.x}, ${this.endSelection.y})`);

              if (this.startSelection === null && this.manualEnd) {
                this.manualEnd = false;
                this.manualStart = true;
              }
            }

            if (this.startSelection !== null && this.endSelection !== null) {
              this.elements.confirmSelection.show();
            }
          }
        },
      );
  },
  onTransform() {
    if (this.selectionModeEnabled && this.startSelection !== null && this.endSelection !== null) {
      const scaleX = (this.endSelection.x - (this.startSelection.x - 1)) * App.scale;
      const scaleY = (this.endSelection.y - (this.startSelection.y - 1)) * App.scale;

      const screenPos = App.boardToScreenSpace(this.startSelection.x, this.startSelection.y);
      this.elements.selectionBorder.css(
        'transform',
        `translate(${screenPos.x}px, ${screenPos.y}px)`,
      );
      this.elements.selectionBorder.css('width', `${scaleX}px`).css('height', `${scaleY}px`);
      this.elements.selectionBorder.show();
    } else {
      this.elements.selectionBorder.hide();
    }
  },
  initBubbles() {
    this.elements.bubbleContainer.empty();
    this.elements.bubbleContainer.append(this.elements.screenshotDiv);
    this.elements.bubbleContainer.append(this.elements.spamEnabledDiv);

    if (this.enableRestrictions) {
      this.elements.bubbleContainer.append(this.elements.restrictionDiv);
      App.elements.restrictedToggle = this.elements.restrictedToggle;
      this.elements.bubbleContainer.append(this.elements.restrictedToggle);
      this.elements.restrictedToggle.click(App.restrictedAreaToggle.bind(App));
    }
  },
  initSpamBlocks() {
    let x = -1;
    let y = -1;
    App.elements.board.on(
      'mousemove',
      (evt) => {
        const boardPos = App.screenToBoardSpace(evt.clientX, evt.clientY);
        if (this.spamBlocksEnabled) {
          App.place(boardPos.x, boardPos.y);
        }
      },
    );

    $(document).on(
      'mousedown',
      (evt) => {
        if (evt.which === 2) {
          this.spamBlocksEnabled = !this.spamBlocksEnabled;
          this.elements.spamEnabledDiv.text(`Spam Enabled: ${this.spamBlocksEnabled}`);
          if (x !== -1 && y !== -1) {
            App.place(x, y);
          }
          evt.preventDefault();
        }
      },
    );
  },
  initCreateRestriction() {
    this.elements.restrictionDiv.click(() => {
      this.startSelectionMode((start, end) => {
        this.restrictSelection(start, end);
        this.reset();
      });
    });
  },
  startSelectionMode(callback) {
    this.reset();
    App.elements.palette.hide();
    this.elements.permaReticule.show();
    this.elements.bubbleContainer.empty();
    this.elements.bubbleContainer.append(this.elements.exitSelectionMode);
    this.elements.bubbleContainer.append(this.elements.startSelection);
    this.elements.bubbleContainer.append(this.elements.endSelection);
    this.elements.bubbleContainer.append(this.elements.confirmSelection);

    this.elements.startSelection.click(() => {
      this.elements.startSelection.text('Start Position');
      this.manualStart = true;
      this.manualEnd = false;
      this.elements.confirmSelection.hide();
    });

    this.elements.endSelection.click(() => {
      this.manualStart = false;
      this.manualEnd = true;
    });

    this.elements.exitSelectionMode.click(() => {
      this.reset();
    });

    this.elements.confirmSelection.click(() => {
      callback(this.startSelection, this.endSelection);
    });

    this.selectionModeEnabled = true;
  },
  restrictSelection(start, end) {
    App.socket.emit('restriction', {
      start,
      end,
    });
  },
  initContextMenu() {
    $.contextMenu('destroy');
    const triggers = ['right', 'left'];
    triggers.forEach((trigger) => {
      $.contextMenu({
        selector: '.username',
        trigger,
        zIndex: 1000,
        autoHide: true,
        items: {
          spectate: {
            name: 'Spectate',
            callback(itemKey, opt) {
              App.spectate(opt.$trigger.text());
            },
          },
          mention: {
            name: 'Mention',
            callback(itemKey, opt) {
              App.mention(opt.$trigger.text());
            },
          },
          sep1: '',
          cooldown: {
            name: 'Cooldown',
            callback(itemKey, opt) {
              App.socket.emit('cooldown', opt.$trigger.text());
            },
          },
          ban: {
            name: 'Ban',
            callback(itemKey, opt) {
              App.socket.emit('ban', opt.$trigger.text());
            },
          },
        },
      });
    });
  },
};

ModTools.init();

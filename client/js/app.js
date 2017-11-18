import '../scss/style.scss';

import websocket from './websocket';
import { debug } from 'util';

function getQueryVariable(variable) {
  const query = window.location.search.substring(1);
  const vars = query.split('&');
  for (let i = 0; i < vars.length; i++) {
    const pair = vars[i].split('=');
    if (decodeURIComponent(pair[0]) === variable) {
      return decodeURIComponent(pair[1]);
    }
  }
  return null;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    }
    : null;
}

function rgb2hex(rgb) {
  const rgbRe = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
  return rgbRe && rgbRe.length === 4
    ? `#${`0${parseInt(rgbRe[1], 10).toString(16)}`.slice(-2)}${`0${parseInt(rgbRe[2], 10).toString(16)}`.slice(-2)}${`0${parseInt(rgbRe[3], 10).toString(16)}`.slice(-2)}`
    : '';
}

window.App = {
  elements: {
    board: $('#board'),
    palette: $('.palette'),
    boardMover: $('.board-mover'),
    boardZoomer: $('.board-zoomer'),
    boardContainer: $('.board-container'),
    cursor: $('.cursor'),
    timer: $('.cooldown-timer'),
    reticule: $('.reticule'),
    alert: $('.message'),
    coords: $('.coords'),
    pixelInfo: $('.pixel-info'),

    chatContainer: $('.chat-container'),
    usersContainer: $('.users-container'),
    loginContainer: $('.login-container'),

    chatToggle: $('.toggle-chat'),
    usersToggle: $('.toggle-users'),
    loginToggle: $('.toggle-login'),

    loginButton: $('.login-button'),
    chatInput: $('.chat-input'),

    restrictedToggle: $('.restricted-toggle'),
  },
  panX: 0,
  panY: 0,
  scale: 4,
  maxScale: 40,
  minScale: 0.75,
  cooldown: 0,
  color: null,
  init() {
    this.color = null;
    this.connectionLost = false;
    this.showRestrictedAreas = false;
    this.restrictedAreas = null;

    this.username = null;
    this.spectate_user = null;

    $('.board-container').hide();
    $('.reticule').hide();
    $('.ui').hide();
    $('.message').hide();
    $('.cursor').hide();
    $('.cooldown-timer').hide();
    this.elements.usersToggle.hide();

    $.get('/boardinfo', this.initBoard.bind(this));

    this.elements.pixelInfo.click(() => {
      this.elements.pixelInfo.addClass('hide');
    });

    this.initBoardMovement();
    this.initBoardPlacement();
    this.initCursor();
    this.initReticule();
    this.initAlert();
    this.initCoords();
    this.initSidebar();
    this.initMoveTicker();
    this.initRestrictedAreas();
    this.initContextMenu();
    Notification.requestPermission();
  },
  initBoard(data) {
    this.width = data.width;
    this.height = data.height;
    this.palette = data.palette;
    this.custom_colors = data.custom_colors;

    this.initPalette();

    this.elements.board.attr('width', this.width).attr('height', this.height);

    this.updateTransform();

    let cx = getQueryVariable('x') || this.width / 2;
    const cy = getQueryVariable('y') || this.height / 2;
    if (cx < 0 || cx >= this.width) cx = this.width / 2;
    if (cy < 0 || cy >= this.height) cx = this.height / 2;
    this.centerOn(cx, cy);

    this.scale = getQueryVariable('scale') || this.scale;
    this.updateTransform();

    this.initSocket();
    this.drawBoard();
  },
  drawBoard() {
    this.image = new Image();

    this.image.onload = () => {
      if (this.connectionLost) this.alert(null);
      const ctx = this.elements.board[0].getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.image, 0, 0, this.width, this.height);
    };

    this.image.onerror = () => {
      this.alert('Refreshing board...');
      setTimeout(this.drawBoard.bind(this), 1000);
    };

    this.image.src = `/board?d=${Date.now()}`;
  },
  initRestrictedAreas() {
    this.elements.restrictedToggle.click(this.restrictedAreaToggle.bind(this));
  },
  restrictedAreaToggle() {
    this.loadRestrictedAreas();
    this.showRestrictedAreas = !this.showRestrictedAreas;
    if (this.showRestrictedAreas) {
      this.elements.restrictedToggle.text('Hide Restricted Areas');
    } else {
      this.elements.restrictedToggle.text('Show Restricted Areas');
    }
  },
  loadRestrictedAreas() {
    if (this.restrictedAreas === null) {
      $.get('/restricted', (restrictions) => {
        this.restrictedAreas = [];
        restrictions.forEach((restriction) => {
          restriction.div = $('<div>', { class: 'selection' });
          $('.ui').append(restriction.div);
          this.restrictedAreas.push(restriction);
        });
      });
    }

    this.elements.board.on('mousemove', () => {
      if (this.restrictedAreas === null) return;
      this.restrictedAreas.forEach((restrictedArea) => {
        if (this.showRestrictedAreas) {
          const scaleX = (restrictedArea.endX - (restrictedArea.startX - 1)) * App.scale;
          const scaleY = (restrictedArea.endY - (restrictedArea.startY - 1)) * App.scale;

          const screenPos = App.boardToScreenSpace(restrictedArea.startX, restrictedArea.startY);
          restrictedArea.div.css('transform', `translate(${screenPos.x}px, ${screenPos.y}px)`);
          restrictedArea.div.css('width', `${scaleX}px`).css('height', `${scaleY}px`);
          restrictedArea.div.show();
        } else {
          restrictedArea.div.hide();
        }
      });
    });
  },
  initPalette() {
    this.palette.forEach((color, idx) => {
      $('<div>')
        .addClass('palette-color')
        .css('background-color', color)
        .click(() => {
          if (this.cooldown === 0) {
            this.switchColor(color);
          } else {
            this.switchColor(null);
          }
        })
        .appendTo(this.elements.palette);
    });

    if (this.custom_colors) {
      $('<input>')
        .addClass('color-picker')
        .appendTo(this.elements.palette);
      $('.color-picker').spectrum({
        showPalette: true,
        showInput: true,
        allowEmpty: true,
        preferredFormat: 'hex',
        localStorageKey: 'kti.place',
        change: (color) => {
          this.switchColor((color !== null) ? color.toHexString() : null);
        },
        show() {
          $('.color-picker').spectrum('reflow');
        },
      });
    }
  },
  initBoardMovement() {
    const handleMove = (evt) => {
      this.panX += evt.dx / this.scale;
      this.panY += evt.dy / this.scale;
      this.updateTransform();
    };

    interact(this.elements.boardContainer[0]).draggable({
      inertia: false,
      onmove: handleMove,
    }).gesturable({
      onmove: (evt) => {
        this.scale *= (1 + evt.ds);
        this.updateTransform();
        handleMove(evt);
      },
    }).styleCursor(false);

    $(document).on('keydown', (evt) => {
      if (evt.target.nodeName === 'BODY') {
        if (evt.keyCode === 87 || evt.keyCode === 38) {
          // Up movement, up arrow or w
          this.panY = (evt.shiftKey) ? this.panY += 1 : this.panY += 100 / this.scale;
        } else if (evt.keyCode === 83 || evt.keyCode === 40) {
          // Down movement, down arrow or s
          this.panY = (evt.shiftKey) ? this.panY -= 1 : this.panY -= 100 / this.scale;
        } else if (evt.keyCode === 65 || evt.keyCode === 37) {
          // Left movement, left arrow or a
          this.panX = (evt.shiftKey) ? this.panX += 1 : this.panX += 100 / this.scale;
        } else if (evt.keyCode === 68 || evt.keyCode === 39) {
          // Right movement, right arrow or d
          this.panX = (evt.shiftKey) ? this.panX -= 1 : this.panX -= 100 / this.scale;
        } else if (evt.keyCode === 81 || evt.keyCode === 34) {
          // Zoom out, q key or page down
          this.scale /= 1.3;
          this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale));
        } else if (evt.keyCode === 69 || evt.keyCode === 33) {
          // Zoom in, e key or page up
          this.scale *= 1.3;
          this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale));
        } else if (evt.keyCode === 27) {
          // Clear color, escape key
          this.switchColor(null);
          this.elements.pixelInfo.addClass('hide');
          this.elements.reticule.hide();
          this.elements.cursor.hide();
        }

        this.updateTransform();
      }
    });

    this.elements.boardContainer.on('wheel', (evt) => {
      this.elements.pixelInfo.addClass('hide');

      const oldScale = this.scale;

      if (evt.originalEvent.deltaY > 0) {
        this.scale /= 1.3;
      } else {
        this.scale *= 1.3;
      }

      this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale));

      const dx = evt.clientX - (this.elements.boardContainer.width() / 2);
      const dy = evt.clientY - (this.elements.boardContainer.height() / 2);

      this.panX -= dx / oldScale;
      this.panX += dx / this.scale;

      this.panY -= dy / oldScale;
      this.panY += dy / this.scale;

      this.updateTransform();
    });
  },
  initBoardPlacement() {
    let downX;
    let downY;
    let clickTriggered = false;

    const downFn = (evt) => {
      downX = evt.clientX;
      downY = evt.clientY;
      clickTriggered = false;
    };

    const upFn = (evt) => {
      if (this.spectate_user !== null) {
        this.spectate_user = null;
        this.alert(null);
      }

      const dx = Math.abs(downX - evt.clientX);
      const dy = Math.abs(downY - evt.clientY);

      if (!clickTriggered) {
        clickTriggered = true;

        if (dx < 5 && dy < 5 && evt.which === 1) {
          const pos = this.screenToBoardSpace(evt.clientX, evt.clientY);

          if (this.color !== null && this.cooldown <= 0) {
            // Place
            this.elements.pixelInfo.addClass('hide');
            this.place(pos.x, pos.y);
          } else if (this.color === null) {
            if (window.ModTools && window.ModTools.selectionModeEnabled) return;

            // Get pixel info
            this.centerOn(pos.x, pos.y);
            const pixelScreenPos = this.boardToScreenSpace(pos.x, pos.y);
            const diff = 0.5 * this.scale;

            this.elements.pixelInfo.css('transform', `translate(${Math.floor(pixelScreenPos.x + diff)}px, ${Math.floor(pixelScreenPos.y + diff)}px)`);
            this.elements.pixelInfo.text('Loading');
            this.elements.pixelInfo.removeClass('hide');
            $.get(`/pixel?x=${pos.x}&y=${pos.y}`, (data) => {
              if (data !== null) {
                const rgb = `rgb(${data.colorR},${data.colorG},${data.colorB})`;
                const span = $('<span>').css('background-color', rgb);
                span.click(() => {
                  this.switchColor(rgb2hex(rgb));
                });
                const date = moment(data.createdAt).format('DD/MM/YYYY hh:mm:ss a');
                this.elements.pixelInfo.text(`Placed by ${data.username} at ${date}`);
                span.prependTo(this.elements.pixelInfo);
              } else {
                this.elements.pixelInfo.text('Nothing has been placed here!');
              }
            });
          }
        } else {
          this.elements.pixelInfo.addClass('hide');
        }
      }
    };
    this.elements.board.on('pointerdown', downFn).on('mousedown', downFn).on('pointerup', upFn).on('mouseup', upFn)
      .contextmenu((evt) => {
        evt.preventDefault();
        this.switchColor(null);
      });
  },
  initCursor() {
    const fn = (evt) => {
      this.elements.cursor.css('transform', `translate(${evt.clientX}px, ${evt.clientY}px)`);
    };
    this.elements.boardContainer.on('pointermove', fn).on('mousemove', fn);
  },
  initReticule() {
    const fn = (evt) => {
      const boardPos = this.screenToBoardSpace(evt.clientX, evt.clientY);
      boardPos.x |= 0;
      boardPos.y |= 0;

      const screenPos = this.boardToScreenSpace(boardPos.x, boardPos.y);
      this.elements.reticule.css('transform', `translate(${screenPos.x}px, ${screenPos.y}px)`);
      this.elements.reticule.css('width', `${this.scale - 1}px`).css('height', `${this.scale - 1}px`);

      if (this.color === null) {
        this.elements.reticule.hide();
      } else {
        this.elements.reticule.show();
      }
    };
    this.elements.board.on('pointermove', fn).on('mousemove', fn);
  },
  initCoords() {
    this.elements.board.on('mousemove', (evt) => {
      const boardPos = this.screenToBoardSpace(evt.clientX, evt.clientY);

      this.elements.coords.text(`(${boardPos.x}, ${boardPos.y})`);
    });
  },
  initAlert() {
    this.elements.alert.find('.close').click(() => {
      this.elements.alert.fadeOut(200);
    });
  },
  initSocket() {
    let pendingMessages = 0;

    this.socket = websocket.connect();
    this.socket.on('connect', () => {
      $('.board-container').show();
      $('.ui').show();
      $('.loading').fadeOut(500);
      this.elements.alert.fadeOut(200);

      if (this.connectionLost) {
        this.drawBoard();
      }
    });

    this.socket.on('disconnect', () => {
      this.connectionLost = true;
      this.elements.loginButton.prop('disabled', false);
      this.alert('Disconnected from server... Attempting to reconnect');
    });

    const moveTickerBody = $('.move-ticker-body');

    // Events sent by websocket
    this.socket.on('session', (data) => {
      if (data.userdata) this.onAuthentication(data.userdata);
      else if (this.username !== null) this.onAuthentication({ success: false });
      if (data.cooldown) this.updateTime(data.cooldown);
      else this.updateTime(0);
      this.updateUserCount(data.users.connected);
      this.updateUserList(data.users);
    });

    this.socket.on('place', (data) => {
      const ctx = this.elements.board[0].getContext('2d');
      ctx.fillStyle = data.color;
      ctx.fillRect(data.x, data.y, 1, 1);

      if (moveTickerBody.is(':visible')) {
        const div = $('<div>', { class: 'chat-line' }).appendTo(moveTickerBody);
        $('<span>', { class: 'username' }).text(data.session_id).appendTo(div);
        $('<a>', { href: `javascript:App.centerOn(${data.x},${data.y})` }).text(`: ${data.x}, ${data.y}`).appendTo(div);
        moveTickerBody.scrollTop(moveTickerBody.prop('scrollHeight'));
        if (moveTickerBody.children().length >= 15) {
          moveTickerBody.children().first().remove();
        }
      }

      if (this.spectate_user !== null && this.spectate_user === data.session_id) {
        this.centerOn(data.x, data.y);
      }
    });

    this.socket.on('alert', (message) => {
      this.alert(message);
    });

    this.socket.on('cooldown', (wait) => {
      this.updateTime(wait);
    });

    this.socket.on('force-sync', () => {
      this.drawBoard();
    });

    this.socket.on('auth', (data) => {
      if (data.message) this.alert(data.message);
      this.onAuthentication(data);
    });

    this.socket.on('users', (data) => {
      this.updateUserCount(data.connected);
      this.updateUserList(data);
    });

    this.socket.on('chat', (data) => {
      const d = $('.chat-log');
      const div = $('<div>', { class: 'chat-line' }).appendTo(d);
      const username = $('<span>', { class: 'username' }).text(data.id);
      const message = $('<span>', { class: 'chat-message' }).text(data.message);

      if (this.elements.chatContainer.is(':hidden') && pendingMessages <= 125) {
        pendingMessages++;
        this.elements.chatToggle.text(`Chat (${pendingMessages})`);
      } else pendingMessages = 0;

      // For regex tests
      let m;
      let re;
      let index;
      let replacementLength;
      let newLength;
      let i;
      let notified = false;
      let matches = [];

      // Check for username in chat indicated by '@'
      re = /(@[a-z0-9]+)/gi;
      do {
        m = re.exec(message.html());
        if (m) {
          const ref = m[0].replace('@', '').toLowerCase();
          if (!notified && data.chat_id !== this.username && (ref === this.username || ref === 'everyone' || ref === 'world')) {
            notified = true;
            new Notification('Place Reloaded', {
              body: `Message from ${data.chat_id}: ${data.message}`,
            });
          }

          const usernameRef = $('<span>', { class: 'username' }).text(m[0]).prop('outerHTML');
          matches.push({ div: usernameRef, index: m.index, length: m[0].length });
        }
      } while (m);

      for (i = matches.length - 1; i >= 0; i--) {
        message.html(message.html().substr(0, matches[i].index) + matches[i].div + message.html().substr(matches[i].index + matches[i].length, message.html().length));
      }
      matches = [];

      // Check for coordinates in message
      re = /([0-9]+)+,( +)?([0-9]+)/g;
      do {
        m = re.exec(message.html());
        if (m) {
          const coords = m[0].split(',');
          if (coords[0] < 0 || coords[0] > this.width || coords[1] < 0 || coords[1] > this.height) continue;
          const coordDiv = $('<a>', { class: '', href: `javascript:App.centerOn(${coords[0]},${coords[1]})` }).text(m[0]).prop('outerHTML');
          matches.push({ div: coordDiv, index: m.index, length: m[0].length });
        }
      } while (m);

      for (i = matches.length - 1; i >= 0; i--) {
        message.html(message.html().substr(0, matches[i].index) + matches[i].div + message.html().substr(matches[i].index + matches[i].length, message.html().length));
      }

      if (data.is_moderator) username.addClass('moderator');
      $('<span>', { class: 'timestamp' }).append($('<small>').text(moment().format('HH:mm'))).appendTo(div);
      username.appendTo(div);
      $('<span>', { class: 'colon' }).text(':').appendTo(div);
      message.appendTo(div);
      d.scrollTop(d.prop('scrollHeight'));
      if (d.children().length >= 125) {
        d.find('.chat-line:first').remove();
      }
    });
  },
  updateUserList(data) {
    let usersList = $('.moderators');
    let userListSection = usersList.closest('.user-list-section');

    if (data.moderators.length !== 0) {
      usersList.empty();
      userListSection.show();
      data.moderators.forEach((user) => {
        $('<div>', { class: 'username moderator' }).text(user).appendTo(usersList);
      });
    } else {
      userListSection.hide();
    }

    usersList = $('.registered');
    userListSection = usersList.closest('.user-list-section');
    if (data.registered.length !== 0) {
      usersList.empty();
      userListSection.show();
      data.registered.forEach((user) => {
        $('<div>', { class: 'username' }).text(user).appendTo(usersList);
      });
    } else {
      userListSection.hide();
    }

    usersList = $('.anons');
    userListSection = usersList.closest('.user-list-section');
    if (data.anons.length !== 0) {
      usersList.empty();
      userListSection.show();
      data.anons.forEach((user) => {
        $('<div>', { class: 'username' }).text(user).appendTo(usersList);
      });
    } else {
      userListSection.hide();
    }
  },
  initContextMenu() {
    // We need multiple triggers for mobile and desktop.
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
        },
      });
    });
  },
  updateUserCount(count) {
    this.elements.usersToggle.fadeIn(200);
    this.elements.usersToggle.text(`Users: ${count}`);
  },
  authenticate() {
    this.socket.emit('auth', {
      username: $('#username').val(),
      password: $('#password').val(),
    });
  },
  onAuthentication(data) {
    if (data.success) {
      this.elements.loginToggle.text('Logout');
      this.elements.loginContainer.hide();
      this.elements.palette.removeClass('palette-sidebar');
      this.username = data.username;

      if (data.is_moderator && !window.ModTools) {
        $.get('js/mod_tools.js');
      }
    } else {
      if (this.username !== null) {
        location.reload();
        return;
      } 
      this.elements.loginToggle.text('Login');
      this.elements.loginButton.prop('disabled', false);
    }
  },
  initSidebar() {
    this.elements.chatToggle.click(() => {
      this.elements.chatContainer.toggle();
      this.elements.usersContainer.hide();
      this.elements.loginContainer.hide();
      this.elements.chatToggle.text('Chat');

      this.elements.palette.toggleClass('palette-sidebar', this.elements.chatContainer.is(':visible'));
    });

    this.elements.usersToggle.click(() => {
      this.elements.chatContainer.hide();
      this.elements.usersContainer.toggle();
      this.elements.loginContainer.hide();

      this.elements.palette.toggleClass('palette-sidebar', this.elements.usersContainer.is(':visible'));
    });

    this.elements.loginToggle.click(() => {
      if (this.username !== null) {
        this.socket.emit('logout');
        return location.reload();
      }
      this.elements.chatContainer.hide();
      this.elements.usersContainer.hide();
      this.elements.loginContainer.toggle();

      this.elements.palette.toggleClass('palette-sidebar', this.elements.loginContainer.is(':visible'));
    });

    this.elements.loginButton.click((evt) => {
      evt.preventDefault();
      this.elements.loginButton.prop('disabled', true);
      this.authenticate();
    });

    this.elements.chatInput.keypress((e) => {
      if (e.which === 13) {
        e.preventDefault();

        const data = this.elements.chatInput.val();
        if (data === '') return;

        this.socket.emit('chat', data);
        this.elements.chatInput.val('');
      }
    });
  },
  initMoveTicker() {
    const userListContainer = $('.user-list');
    const moveTickerHeader = $('.move-ticker-header');
    const moveTickerBody = $('.move-ticker-body');

    moveTickerHeader.click(() => {
      moveTickerBody.toggle();
      moveTickerBody.scrollTop(moveTickerBody.prop('scrollHeight'));

      if (moveTickerBody.is(':visible')) {
        userListContainer.addClass('user-list-ticker');
      } else {
        userListContainer.removeClass('user-list-ticker');
      }
    });
  },
  updateTransform() {
    if (this.panX <= -this.width / 2) {
      this.panX = -this.width / 2;
    }
    if (this.panX >= this.width / 2) {
      this.panX = this.width / 2;
    }
    if (this.panY <= -this.height / 2) {
      this.panY = -this.height / 2;
    }
    if (this.panY >= this.height / 2) {
      this.panY = this.height / 2;
    }

    this.elements.boardMover
      .css('width', `${this.width}px`)
      .css('height', `${this.height}px`)
      .css('transform', `translate(${this.panX}px, ${this.panY}px)`);
    this.elements.reticule.css('width', `${this.scale}px`).css('height', `${this.scale}px`);
    this.elements.boardZoomer.css('transform', `scale(${this.scale})`);
  },
  screenToBoardSpace(screenX, screenY) {
    const boardBox = this.elements.board[0].getBoundingClientRect();
    return {
      x: (((screenX - boardBox.left) / this.scale) | 0),
      y: (((screenY - boardBox.top) / this.scale) | 0),
    };
  },
  boardToScreenSpace(boardX, boardY) {
    const boardBox = this.elements.board[0].getBoundingClientRect();
    return {
      x: (boardX * this.scale) + boardBox.left,
      y: (boardY * this.scale) + boardBox.top,
    };
  },
  centerOn(x, y) {
    this.panX = ((this.width / 2) - x) - 0.5;
    this.panY = ((this.height / 2) - y) - 0.5;
    this.elements.coords.text(`(${x}, ${y})`);
    this.updateTransform();
  },
  switchColor(newColor) {
    this.color = newColor;

    if (newColor === null) {
      this.elements.cursor.hide();
    } else {
      this.elements.cursor.show();
      this.elements.cursor.css('background-color', newColor);
    }
  },
  place(x, y) {
    if (this.color === null) return;

    this.socket.emit('place', {
      x,
      y,
      color: this.color,
    });

    // this.switchColor(-1);
  },
  alert(message) {
    const alert = this.elements.alert;
    if (message === null) {
      this.elements.alert.fadeOut(200);
      return;
    }

    alert.find('.text').text(message);
    alert.fadeIn(200);
  },
  updateTime(cooldown) {
    if (typeof cooldown !== 'undefined') this.cooldown = cooldown;
    else this.cooldown -= 1;

    if (this.cooldown < 0) this.cooldown = 0;
    this.cooldown |= 0;

    if (this.cooldown !== 0) {
      this.elements.timer.show();
      const secs = Math.floor(this.cooldown % 60);
      const secsStr = secs < 10 ? `0${secs}` : secs;
      const minutes = Math.floor(this.cooldown / 60);
      const minuteStr = minutes < 10 ? `0${minutes}` : minutes;
      this.elements.timer.text(`${minuteStr}:${secsStr}`);

      $('.palette-color').css('cursor', 'not-allowed');
      setTimeout(this.updateTime.bind(this), 1000);
    } else {
      this.elements.timer.hide();
      $('.palette-color').css('cursor', '');
    }
  },
  spectate(username) {
    if (username.startsWith('@')) {
      username = username.substr(1);
    }
    this.alert(`Spectating ${username}`);
    this.spectate_user = username;
  },
  mention(username) {
    this.elements.usersContainer.hide();
    this.elements.chatContainer.show();
    if (!username.startsWith('@')) username = `@${username}`;
    this.elements.chatInput.val(`${this.elements.chatInput.val() + username} `);
    this.elements.chatInput.focus();
  },
  toURL() {
    const link = document.getElementById('download');
    link.href = this.elements.board[0].toDataURL();
    link.download = 'canvas.png';
  },
};

const { App } = window;
App.init();

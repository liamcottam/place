function getQueryVariable(variable) {
  var query = window.location.search.substring(1);
  var vars = query.split('&');
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split('=');
    if (decodeURIComponent(pair[0]) === variable) {
      return decodeURIComponent(pair[1]);
    }
  }
}

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function setAuthCookie(session_key, username) {
  var l = window.location;
  var d = new Date();
  d.setTime(d.getTime() + (7 * 24 * 60 * 60 * 1000));
  var expires = "expires=" + d.toUTCString();
  var cookie = 'session=' + session_key + ':' + username + ';' + expires + ";path=/;";
  if (l.protocol === 'https:') {
    cookie += 'secure;';
  }

  document.cookie = cookie;
}


function getAuthCookie() {
  var name = 'session=';
  var ca = document.cookie.split(';');
  for (var i = 0; i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      var substr = c.substring(name.length, c.length).split(':');
      return {
        session_key: substr[0],
        username: substr[1]
      };
    }
  }
  return null;
}

function deleteAuthCookie() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  var expires = "expires=" + d;
  document.cookie = 'session' + "=;" + expires + "; path=/";
}

window.App = {
  elements: {
    board: $("#board"),
    palette: $(".palette"),
    boardMover: $(".board-mover"),
    boardZoomer: $(".board-zoomer"),
    boardContainer: $(".board-container"),
    cursor: $(".cursor"),
    timer: $(".cooldown-timer"),
    reticule: $(".reticule"),
    alert: $(".message"),
    coords: $(".coords"),

    chatContainer: $('.chat-container'),
    usersContainer: $('.users-container'),
    loginContainer: $('.login-container'),
    usersToggle: $('.toggle-users'),

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
  cooldown: 0,
  init: function () {
    this.color = -1;
    this.connectionLost = false;
    this.mod_tools_requested = false;
    this.showRestrictedAreas = false;
    this.restrictedAreas = null;

    this.username = null;
    this.session_id = null;
    this.session_key = null;
    this.spectate_user = null;

    $(".board-container").hide();
    $(".reticule").hide();
    $(".ui").hide();
    $('.message').hide();
    $(".cursor").hide();
    $(".cooldown-timer").hide();
    this.elements.usersToggle.hide();

    $.get("/boardinfo", this.initBoard.bind(this));

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
  initBoard: function (data) {
    this.width = data.width;
    this.height = data.height;
    this.palette = data.palette;

    this.initPalette();

    this.elements.board.attr("width", this.width).attr("height", this.height);

    this.updateTransform();

    var cx = getQueryVariable("x") || this.width / 2;
    var cy = getQueryVariable("y") || this.height / 2;
    if (cx < 0 || cx >= this.width) cx = this.width / 2;
    if (cy < 0 || cy >= this.height) cx = this.height / 2;
    this.centerOn(cx, cy);

    this.scale = getQueryVariable("scale") || this.scale;
    this.updateTransform();

    this.initSocket();
    this.drawBoard();
  },
  drawBoard: function () {
    this.image = new Image();
    this.image.onload = function () {
      var ctx = this.elements.board[0].getContext("2d");
      ctx.drawImage(this.image, 0, 0, this.width, this.height);
    }.bind(this);

    this.image.onerror = function () {
      $(".loading").fadeIn(500);
      $(".loading").children().first().text('Failed to load image, please refresh');
    };
    this.image.src = '/boarddata?d=' + Date.now();
  },
  initRestrictedAreas: function () {
    this.elements.restrictedToggle.click(this.restrictedAreaToggle.bind(this));
  },
  restrictedAreaToggle: function () {
    this.loadRestrictedAreas();
    this.showRestrictedAreas = !this.showRestrictedAreas;
    if (this.showRestrictedAreas) {
      this.elements.restrictedToggle.text('Hide Restricted Areas');
    } else {
      this.elements.restrictedToggle.text('Show Restricted Areas');
    }
  },
  loadRestrictedAreas: function () {
    if (this.restrictedAreas === null) {
      $.get('/restricted', function (restrictions) {
        this.restrictedAreas = [];
        restrictions.forEach(function (restriction) {
          restriction.div = $('<div>', { class: 'selection' });
          $('.ui').append(restriction.div);
          this.restrictedAreas.push(restriction);
        }.bind(this));
      }.bind(this));
    }

    this.elements.board.on('mousemove', function (evt) {
      if (this.restrictedAreas === null) return;

      this.restrictedAreas.forEach(function (restrictedArea) {
        if (this.showRestrictedAreas) {
          var scaleX = (restrictedArea.end.x - (restrictedArea.start.x - 1)) * App.scale;
          var scaleY = (restrictedArea.end.y - (restrictedArea.start.y - 1)) * App.scale;

          var screenPos = App.boardToScreenSpace(restrictedArea.start.x, restrictedArea.start.y);
          restrictedArea.div.css("transform", "translate(" + screenPos.x + "px, " + screenPos.y + "px)");
          restrictedArea.div.css("width", scaleX + "px").css("height", scaleY + "px");
          restrictedArea.div.show();
        } else {
          restrictedArea.div.hide();
        }
      }.bind(this));
    }.bind(this));
  },
  initPalette: function () {
    this.palette.forEach(function (color, idx) {
      $("<div>")
        .addClass("palette-color")
        .css("background-color", color)
        .click(function () {
          if (this.cooldown === 0) {
            this.switchColor(idx);
          } else {
            this.switchColor(-1);
          }
        }.bind(this))
        .appendTo(this.elements.palette);
    }.bind(this));
  },
  initBoardMovement: function () {
    var handleMove = function (evt) {
      this.panX += evt.dx / this.scale;
      this.panY += evt.dy / this.scale;
      this.updateTransform();
    }.bind(this);

    interact(this.elements.boardContainer[0]).draggable({
      inertia: false,
      onmove: handleMove
    }).gesturable({
      onmove: function (evt) {
        this.scale *= (1 + evt.ds);
        this.updateTransform();
        handleMove(evt);
      }.bind(this)
    }).styleCursor(false);

    $(document).on('keydown', function (evt) {
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
          this.switchColor(-1);
        }

        this.updateTransform();
      }
    }.bind(this));

    this.elements.boardContainer.on('wheel', function (evt) {
      var oldScale = this.scale;

      if (evt.originalEvent.deltaY > 0) {
        this.scale /= 1.3
      } else {
        this.scale *= 1.3;
      }

      this.scale = Math.min(40, Math.max(0.75, this.scale));

      var dx = evt.clientX - this.elements.boardContainer.width() / 2;
      var dy = evt.clientY - this.elements.boardContainer.height() / 2;

      this.panX -= dx / oldScale;
      this.panX += dx / this.scale;

      this.panY -= dy / oldScale;
      this.panY += dy / this.scale;

      this.updateTransform();
    }.bind(this));
  },
  initBoardPlacement: function () {
    var downX, downY;
    var clickTriggered = false;

    var downFn = function (evt) {
      downX = evt.clientX;
      downY = evt.clientY;
      clickTriggered = false;
    };

    var upFn = function (evt) {
      if (this.spectate_user !== null) {
        this.spectate_user = null;
        this.alert(null);
      }

      var dx = Math.abs(downX - evt.clientX);
      var dy = Math.abs(downY - evt.clientY);

      if (dx < 5 && dy < 5 && this.color !== -1 && this.cooldown <= 0 && evt.which === 1 && !clickTriggered) {
        clickTriggered = true;
        var pos = this.screenToBoardSpace(evt.clientX, evt.clientY);
        this.place(pos.x, pos.y);
      }
    }.bind(this);
    this.elements.board.on("pointerdown", downFn).on("mousedown", downFn).on("pointerup", upFn).on("mouseup", upFn).contextmenu(function (evt) {
      evt.preventDefault();
      this.switchColor(-1);
    }.bind(this));
  },
  initCursor: function () {
    var fn = function (evt) {
      this.elements.cursor.css("transform", "translate(" + evt.clientX + "px, " + evt.clientY + "px)");
    }.bind(this);
    this.elements.boardContainer.on("pointermove", fn).on("mousemove", fn);
  },
  initReticule: function () {
    var fn = function (evt) {
      var boardPos = this.screenToBoardSpace(evt.clientX, evt.clientY);
      boardPos.x |= 0;
      boardPos.y |= 0;

      var screenPos = this.boardToScreenSpace(boardPos.x, boardPos.y);
      this.elements.reticule.css("transform", "translate(" + screenPos.x + "px, " + screenPos.y + "px)");
      this.elements.reticule.css("width", this.scale - 1 + "px").css("height", this.scale - 1 + "px");

      if (this.color === -1) {
        this.elements.reticule.hide();
      } else {
        this.elements.reticule.show();
      }
    }.bind(this);
    this.elements.board.on("pointermove", fn).on("mousemove", fn);
  },
  initCoords: function () {
    this.elements.board.on("mousemove", function (evt) {
      var boardPos = this.screenToBoardSpace(evt.clientX, evt.clientY);

      this.elements.coords.text("(" + boardPos.x + ", " + boardPos.y + ")");
    }.bind(this));
  },
  initAlert: function () {
    this.elements.alert.find(".close").click(function () {
      this.elements.alert.fadeOut(200);
    }.bind(this));
  },
  initSocket: function () {
    var pendingMessages = 0;

    this.socket = io();
    this.socket.on('connect', function () {
      $(".board-container").show();
      $(".ui").show();
      $(".loading").fadeOut(500);
      this.elements.alert.fadeOut(200);

      var auth = getAuthCookie();
      if (auth !== null) {
        this.username = auth.username;
        this.session_key = auth.session_key;

        this.socket.emit('reauth', {
          username: this.username,
          session_key: this.session_key
        });
      }

      if (this.connectionLost) {
        this.drawBoard();
      }
    }.bind(this));

    this.socket.on('disconnect', function () {
      this.connectionLost = true;
      this.alert('Disconnected from server... Attempting to reconnect');
    }.bind(this));

    var moveTickerBody = $('.move-ticker-body');

    // Events sent by websocket
    this.socket.on('session', function (data) {
      this.session_id = data.session_id;
      this.updateUserCount(data.users.connected);
      this.updateUserList(data.users);
    }.bind(this));

    this.socket.on('place', function (data) {
      var ctx = this.elements.board[0].getContext("2d");
      ctx.fillStyle = data.color;
      ctx.fillRect(data.x, data.y, 1, 1);

      if (moveTickerBody.is(':visible')) {
        var div = $('<div>', { 'class': 'chat-line' }).appendTo(moveTickerBody);
        $('<span>', { "class": 'username' }).text(data.session_id).appendTo(div);
        $('<a>', { href: 'javascript:App.centerOn(' + data.x + ',' + data.y + ')' }).text(': ' + data.x + ', ' + data.y).appendTo(div);
        moveTickerBody.scrollTop(moveTickerBody.prop('scrollHeight'));
        if (moveTickerBody.children().length >= 15) {
          moveTickerBody.children().first().remove();
        }
      }

      if (this.spectate_user !== null && this.spectate_user === data.session_id) {
        this.centerOn(data.x, data.y);
      }
    }.bind(this));

    this.socket.on('alert', function (message) {
      this.alert(message);
    }.bind(this));

    this.socket.on('cooldown', function (wait) {
      this.cooldown = Math.ceil(wait + 1);
      this.updateTime();
    }.bind(this));

    this.socket.on('force-sync', function () {
      this.drawBoard();
    }.bind(this));

    this.socket.on('auth', function (data) {
      if (data.message) this.alert(data.message);
      this.onAuthentication(data, false);
    }.bind(this));

    this.socket.on('reauth', function (data) {
      if (data.message) this.alert(data.message);
      this.onAuthentication(data, true);
    }.bind(this));

    this.socket.on('users', function (data) {
      this.updateUserCount(data.connected);
      this.updateUserList(data);
    }.bind(this));

    this.socket.on('chat', function (data) {
      var d = $('.chat-log');
      var div = $('<div>', { 'class': 'chat-line' }).appendTo(d);
      var username = $('<span>', { "class": 'username' }).text(data.chat_id);
      var message = $('<span>', { "class": 'chat-message' }).text(': ' + data.message);

      if (this.elements.chatContainer.is(':hidden') && pendingMessages <= 125) {
        pendingMessages++;
        this.elements.chatToggle.text('Chat (' + pendingMessages + ')');
      } else pendingMessages = 0;

      // For regex tests
      var m, re, index, replacementLength, newLength;
      var notified = false;
      var matches = [];

      // Check for username in chat indicated by '@'
      var re = /(@[a-z0-9]+)/gi;
      do {
        m = re.exec(message.html());
        if (m) {
          var ref = m[0].replace('@', '').toLowerCase();
          if (!notified && data.chat_id !== this.username && (ref === this.username || ref === 'everyone' || ref === 'world')) {
            notified = true;
            new Notification("Place Reloaded", {
              body: 'Message from ' + data.chat_id + ': ' + data.message
            });
          }

          var usernameRef = $('<span>', { class: 'username' }).text(m[0]).prop('outerHTML');
          matches.push({ div: usernameRef, index: m.index, length: m[0].length });
        }
      } while (m);

      for (var i = matches.length - 1; i >= 0; i--) {
        message.html(message.html().substr(0, matches[i].index) + matches[i].div + message.html().substr(matches[i].index + matches[i].length, message.html().length));
      }
      matches = [];

      // Check for coordinates in message
      re = /([0-9]+)+\,(\ +)?([0-9]+)/g;
      do {
        m = re.exec(message.html());
        if (m) {
          var coords = m[0].split(',');
          if (coords[0] < 0 || coords[0] > this.width || coords[1] < 0 || coords[1] > this.height) continue;
          var coordDiv = $('<a>', { class: '', href: 'javascript:App.centerOn(' + coords[0] + ',' + coords[1] + ')' }).text(m[0]).prop('outerHTML');
          matches.push({ div: coordDiv, index: m.index, length: m[0].length });
        }
      } while (m);

      for (var i = matches.length - 1; i >= 0; i--) {
        message.html(message.html().substr(0, matches[i].index) + matches[i].div + message.html().substr(matches[i].index + matches[i].length, message.html().length));
      }

      if (data.is_moderator) username.addClass('moderator');
      username.appendTo(div);
      message.appendTo(div);
      d.scrollTop(d.prop('scrollHeight'));
      if (d.children().length >= 125) {
        d.find('.chat-line:first').remove();
      }
    }.bind(this));
  },
  updateUserList: function (data) {
    var usersList = $('.moderators');
    var userListSection = usersList.closest('.user-list-section');

    if (data.moderators.length !== 0) {
      usersList.empty();
      userListSection.show();
      data.moderators.forEach(function (user) {
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
      data.registered.forEach(function (user) {
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
      data.anons.forEach(function (user) {
        $('<div>', { class: 'username' }).text(user).appendTo(usersList);
      });
    } else {
      userListSection.hide();
    }
  },
  initContextMenu: function () {
    // We need multiple triggers for mobile and desktop.
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
          }
        }
      });
    });
  },
  updateUserCount: function (count) {
    this.elements.usersToggle.fadeIn(200);
    this.elements.usersToggle.text('Users: ' + count);
  },
  authenticateChat: function () {
    this.username = $('#username').val();

    this.socket.emit('auth', {
      username: this.username,
      password: $('#password').val()
    });
  },
  onAuthentication: function (data, reauth) {
    if (data.success) {
      this.session_key = data.session_key;
      this.elements.loginToggle.text('Logout');
      this.elements.loginContainer.hide();
      this.elements.palette.removeClass('palette-sidebar');

      if (!reauth)
        setAuthCookie(data.session_key, this.username);

      if (data.is_moderator && !this.mod_tools_requested) {
        this.mod_tools_requested = true;
        $.get('js/mod_tools.js', function (data) { eval(data) });
      }
    } else {
      this.session_key = null;
      this.username = null;
      deleteAuthCookie();
      if (reauth) location.reload();

      this.elements.loginToggle.text('Login');
      this.elements.loginButton.prop('disabled', false);
    }
  },
  initSidebar: function () {
    this.elements.chatToggle.click(function () {
      this.elements.chatContainer.toggle();
      this.elements.usersContainer.hide();
      this.elements.loginContainer.hide();
      this.elements.chatToggle.text('Chat');

      if (this.elements.chatContainer.is(':visible')) {
        this.elements.palette.addClass('palette-sidebar');
        this.elements.chatInput.focus();
      } else {
        this.elements.palette.removeClass('palette-sidebar');
      }
    }.bind(this));

    this.elements.usersToggle.click(function () {
      this.elements.chatContainer.hide();
      this.elements.usersContainer.toggle();
      this.elements.loginContainer.hide();

      if (this.elements.usersContainer.is(':visible')) {
        this.elements.palette.addClass('palette-sidebar');
      } else {
        this.elements.palette.removeClass('palette-sidebar');
      }
    }.bind(this));

    this.elements.loginToggle.click(function () {
      if (this.session_key !== null) {
        this.socket.emit('logout', {
          type: 'logout',
          session_key: this.session_key
        });
        this.session_key = null;
        this.username = null;
        deleteAuthCookie();
        location.reload();

        this.elements.loginToggle.text('Login');
        this.elements.loginButton.prop('disabled', false);
        return;
      }
      this.elements.chatContainer.hide();
      this.elements.usersContainer.hide();
      this.elements.loginContainer.toggle();

      if (this.elements.loginContainer.is(':visible')) {
        this.elements.palette.addClass('palette-sidebar');
        $('#username').focus();

      } else {
        this.elements.palette.removeClass('palette-sidebar');
      }

    }.bind(this));

    this.elements.loginButton.click(function () {
      this.elements.loginButton.prop('disabled', true);
      this.authenticateChat();
    }.bind(this));

    this.elements.chatInput.keypress(function (e) {
      if (e.which == 13) {
        e.preventDefault();

        var data = this.elements.chatInput.val();
        if (data === '') return;

        this.socket.emit('chat', data);
        this.elements.chatInput.val('');
      }
    }.bind(this));
  },
  initMoveTicker: function () {
    var userListContainer = $('.user-list');
    var moveTickerHeader = $('.move-ticker-header');
    var moveTickerBody = $('.move-ticker-body');

    moveTickerHeader.click(function () {
      moveTickerBody.toggle();
      moveTickerBody.scrollTop(moveTickerBody.prop('scrollHeight'));

      if (moveTickerBody.is(':visible')) {
        userListContainer.addClass('user-list-ticker');
      } else {
        userListContainer.removeClass('user-list-ticker');
      }
    });
  },
  updateTransform: function () {

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
      .css("width", this.width + "px")
      .css("height", this.height + "px")
      .css("transform", "translate(" + this.panX + "px, " + this.panY + "px)");
    this.elements.reticule.css("width", this.scale + "px").css("height", this.scale + "px");
    this.elements.boardZoomer.css("transform", "scale(" + this.scale + ")");
  },
  screenToBoardSpace: function (screenX, screenY) {
    var boardBox = this.elements.board[0].getBoundingClientRect();
    var boardX = (((screenX - boardBox.left) / this.scale) | 0),
      boardY = (((screenY - boardBox.top) / this.scale) | 0);
    return { x: boardX, y: boardY };
  },
  boardToScreenSpace: function (boardX, boardY) {
    var boardBox = this.elements.board[0].getBoundingClientRect();
    var x = boardX * this.scale + boardBox.left,
      y = boardY * this.scale + boardBox.top;
    return { x: x, y: y };
  },
  centerOn: function (x, y) {
    this.panX = (this.width / 2 - x) - 0.5;
    this.panY = (this.height / 2 - y) - 0.5;
    this.elements.coords.text("(" + x + ", " + y + ")");
    this.updateTransform();
  },
  switchColor: function (newColor) {
    this.color = newColor;

    if (newColor === -1) {
      this.elements.cursor.hide();
    } else {
      this.elements.cursor.show();
      this.elements.cursor.css("background-color", this.palette[newColor]);
    }
  },
  place: function (x, y) {
    if (this.color === -1) return;

    this.socket.emit('place', {
      x: x,
      y: y,
      color: this.palette[this.color],
    });

    //this.switchColor(-1);
  },
  alert: function (message) {
    var alert = this.elements.alert;
    if (message === null) {
      this.elements.alert.fadeOut(200);
      return;
    }

    alert.find(".text").text(message);
    alert.fadeIn(200);
  },
  updateTime: function () {
    var last = this.cooldown;

    this.cooldown -= 1;
    if (this.cooldown < 0) this.cooldown = 0;
    this.cooldown |= 0;

    if (this.cooldown !== 0) {
      this.elements.timer.show();
      var secs = Math.floor(this.cooldown % 60);
      var secsStr = secs < 10 ? "0" + secs : secs;
      var minutes = Math.floor(this.cooldown / 60);
      var minuteStr = minutes < 10 ? "0" + minutes : minutes;
      this.elements.timer.text(minuteStr + ":" + secsStr);

      $(".palette-color").css("cursor", "not-allowed")
    } else {
      this.elements.timer.hide();
      $(".palette-color").css("cursor", "")
    }

    if (this.cooldown === 0 && last !== 0) {
      /*new Notification("Place Thing", {
        body: "Your next pixel is available!"
      });*/
    } else {
      setTimeout(this.updateTime.bind(this), 1000);
    }
  },
  spectate: function (username) {
    if (username.startsWith('@')) {
      username = username.substr(1);
    }
    this.alert('Spectating ' + username);
    this.spectate_user = username;
  },
  mention: function (username) {
    this.elements.usersContainer.hide();
    this.elements.chatContainer.show();
    if (!username.startsWith('@')) username = '@' + username;
    this.elements.chatInput.val(this.elements.chatInput.val() + username + ' ');
    this.elements.chatInput.focus();
  },
  toURL: function () {
    window.open(this.elements.board[0].toDataURL(), '_blank');
  }
};

App.init();
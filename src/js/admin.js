window.AdminTools = {
  elements: {
    toolsContainer: $('.tools-container'),
    backupsContainer: $('.backups-container'),

    toolsToggle: $('.toggle-tools'),
    backupsToggle: $('.toggle-backups'),
  },
  init: function () {
    this.backupList = null;
    this.currentBackup = null;
    this.backupBuffer = null;

    this.elements.toolsToggle.click(function () {
      this.elements.toolsContainer.toggle();

      if (this.elements.toolsContainer.is(':visible')) {
        this.elements.backupsContainer.hide();
      }
    }.bind(this));

    this.elements.backupsToggle.click(function () {
      this.elements.backupsContainer.toggle();

      if (this.elements.backupsContainer.is(':visible')) {
        this.elements.toolsContainer.hide();
        if (this.backupList === null) {
          this.loadBackups();
        }
      }
    }.bind(this));

    this.initTools();
    this.initContextMenus();
  },
  initTools: function () {
    var clearSquare = $('<div>', { text: 'Clear Square' });
    var restoreSection = $('<div>', { text: 'Restore Section' });
    var returnToLive = $('<div>', { text: 'Return to live board' });

    restoreSection.click(function () {
      if (this.backupBuffer === null) return;

      ModTools.startSelectionMode(function (start, end) {
        $.post({
          url: '/admin/restore',
          data: {
            startx: start.x,
            starty: start.y,
            endx: end.x,
            endy: end.y,
            filename: this.currentBackup
          }
        }).done(function () {
          returnToLive.click();
        }.bind(this));
      }.bind(this));
    }.bind(this));

    clearSquare.click(this.toolClearSquare.bind(this));
    returnToLive.click(function () {
      $.get("/boarddata", function (data) {
        App.drawBoard(data);
        if (!App.socket.connected)
          App.initSocket();
      }.bind(this));
    }.bind(this));

    this.elements.toolsContainer.append(clearSquare);
    this.elements.toolsContainer.append(restoreSection);
    this.elements.toolsContainer.append(returnToLive);
  },
  toolClearSquare: function () {
    ModTools.startSelectionMode(function (start, end) {
      $.post({
        url: '/admin/delete',
        data: {
          startx: start.x,
          starty: start.y,
          endx: end.x,
          endy: end.y,
        }
      });
    }.bind(this));
  },
  loadBackups: function () {
    this.elements.backupsContainer.empty();

    $.get('/admin/backups', function (data) {
      data.forEach(function (backup) {
        var div = $('<div>', { class: 'backup' }).text(backup);
        div.click(function () { this.loadBackup(backup) }.bind(this));
        this.elements.backupsContainer.append(div);
      }.bind(this));
      this.backupList = data;
    }.bind(this)).fail(function (res) {
      $('<div>').text('Failed to load backups: ' + res.responseText).appendTo(this.elements.backupsContainer);
      console.log(error);
    }.bind(this));
  },
  loadBackup: function (filename) {
    App.alert(filename);
    this.currentBackup = filename;
    $.get('/admin/backup/' + filename, function (backup) {
      var imageDataLen = App.width * App.height;
      this.backupBuffer = new Uint32Array(imageDataLen);
      for (var i = 0; i < imageDataLen; i++) {
        this.backupBuffer[i] = backup.charCodeAt(i);
      }

      App.socket.close();
      App.drawBoard(backup);
    }.bind(this));
  },
  initContextMenus: function () {
    $.contextMenu({
      selector: '.backup',
      trigger: 'right',
      zIndex: 1000,
      items: {
        restore: {
          name: 'Restore Entire Backup',
          callback: function (itemKey, opt) {
            this.confirmBackupRestore(opt.$trigger.text());
          }.bind(this)
        },
      }
    });
  },
  confirmBackupRestore: function (filename) {
    swal({
      title: 'Restore ' + filename,
      type: 'warning',
      showCancelButton: true,
      confirmButtonColor: "#DD6B55",
      confirmButtonText: 'Confirm',
    }, function () {
      // TODO
    });
  }
};

$.get('/js/app.js', function (data) {
  $.get('/js/mod_tools.js', function (data) {
    AdminTools.init();
  });
});
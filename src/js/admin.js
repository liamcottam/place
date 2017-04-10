window.AdminTools = {
  elements: {
    toolsContainer: $('.tools-container'),
    backupsContainer: $('.backups-container'),

    toolsToggle: $('.toggle-tools'),
    backupsToggle: $('.toggle-backups'),
  },
  init: function () {
    this.backupList = null;

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
  },
  initTools: function () {
    var clearSquare = $('<div>', { text: 'Clear Square' });
    clearSquare.click(this.toolClearSquare.bind(this));

    this.elements.toolsContainer.append(clearSquare);
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
    $.get('/admin/backups', function (data) {
      data.forEach(function (backup) {
        $('<div>').text(backup).appendTo(this.elements.backupsContainer);
      }.bind(this));
      this.backupList = data;

    }.bind(this));
  }
};

$.get('/js/app.js', function (data) {
  $.get('/js/mod_tools.js', function (data) {
    AdminTools.init();
  });
});
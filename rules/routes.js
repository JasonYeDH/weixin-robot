var fs = require('fs');
var data = require('../data');
var messages = data.messages;

var User = require('../lib/user').User;
var parser = require('../lib/parser');
var douban = require('../lib/douban');
var router = require('../lib/router')();

// Special type for location
router.set('location', function(info, next) {
  parser.geo2loc(info.param, function(loc_id) {
    info.param.loc = loc_id;
    return douban.nearby(info.param, next);
  });
});


var dialogs = parser.txt2dialog(fs.readFileSync(__dirname + '/dialogs.txt', 'utf-8'));
// 先看一下是否可以直接对话 
router.set('dialog', {
  'handler': function(info) {
    var text = info['text'];
    if (text) {
      for (var i = 0, l = dialogs.length; i < l; i++) {
        var r = dialogs[i];
        if (text.search(r[0]) !== -1) return r[1];
      }
    }
  }
});

router.set('list', {
  'parser': function(info) {
    info.param = parser.listParam(info.text);
    return info;
  },
  'handler': function(info, next) {
    var uid = info.from;
    var u = new User(uid);

    // is waiting for user to reply a city name
    var want_city = this.waiter.reserve(uid) === 'search' && this.waiter.data(uid, 'want') === 'city';
    var loc = info.param && info.param['loc'];

    if (want_city && loc) {
      u.loc(loc);
      var q = this.waiter.data(uid, 'q');
      if (q) {
        this.waiter.pass(uid);
        info.param['q'] = q;
        return douban.search(info.param, next);
      }
    }
    if (loc) {
      u.loc(loc);
    } else {
      loc = info.param.loc = u.loc();
    }
    if (!loc) next('CITY_404');

    // 如果有搜索关键字
    if (info.param['q']) next();

    douban.list(info.param, next);
  }
});
// 最后提示是否搜索
router.set('short_text', {
  'pattern': function(info) {
    var text = info.param && info.param['q'] || info.text;
    return text.length > 1 && text.length < 10;
  },
  'handler': function(info, next) {
    var tip = this.waiter.reserve(info.from, 'search', info);
    next(null, tip);
  }
});

module.exports = router;

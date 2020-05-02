//=============================================================================
// SNZ_FirebaseSave.js
// Version: 1.0
//----------------------------------------------------------------------------
// by しんぞ
// Released under the MIT license
// http://opensource.org/licenses/mit-license.php
//=============================================================================

/*:
@plugindesc FirebaseというWebサービスを使用し、クラウドセーブ（オンラインセーブ）を実現。
@author しんぞ

@help 「クラウドでオートセーブ」という虫のいい願望を自分なりに叶えてみました。
ゲームデータ一式をレンタルサーバーなどにアップロードすることを
想定して作っています。
（Firebaseにもホスティングサービスはありますが、従量課金なので
　音声や画像を多用する作品には向かなさそうです←試しました）

セーブスロットは一つで、セーブ実行時に上書きされます。
ですので、セーブデータを使い分ける必要のないゲーム向きです。
ちなみに、内部的には古いセーブデータも5つまでサーバーに残してあり、
セーブが壊れていたら自動的に古いファイルをさかのぼってリトライします。

Firebaseへの登録の際にGoogleアカウントが必要です。
さらにTwitterやFacebookでの認証を実現するために
それぞれのサービスでアプリケーション登録という作業をする必要があり、
その際に、ご自身のアカウントが必要になります。

todo:
authのタイムラグ対応
メニューの「セーブ」をもうちょっと親切にする

プラグインコマンド
FirebaseSave : 上書きセーブを実行します。
ユーザーがクラウドセーブを選択している場合はオンラインのセーブデータを、
ローカルセーブを選択している場合はローカルのセーブデータを上書きします。
（イベントコマンドで「セーブ不可」設定にしているときは何もしません）
これをゲームの随所で実行すればオートセーブが実現できます。

利用規約
ご自由に。クレジットもあってもなくてもいいです。改造改変歓迎。

ところで、さばの文化干しっておいしいのに話題にのぼらなくてかわいそうだよね。

@param savedesc
@desc オンラインセーブについての説明文章です。改行は&lt;br&gt;と書いてください。
@default ソーシャルアカウントと連携すると<br>セーブのバックアップができます。<br>勝手に投稿することはありません。

@param usetwitter
@desc Twitterアカウントでのセーブを使用しますか？
@type boolean
@on 使用する
@off 使用しない
@default true

@param usefacebook
@desc Facebookアカウントでのセーブを使用しますか？
@type boolean
@on 使用する
@off 使用しない
@default true

@param starttext
@desc スタート画面で表示する文字です。
@default Press Start

@param startfont
@text スタート画面のフォント情報です。
@type struct<startfont>
@default {"fontface": "", "size":"52", "bold":"false", "italic":"false", "color": " rgba(255,255,255,1.0)"}

@param startse
@text スタートした時の効果音の情報です。
@type struct<startse>
@default {"name":"", "volume": "90", "pitch":"100", "pan":"0"}

@param firebaseconfig
@text Firebase所定のタグのうち"config"で囲まれた箇所の情報です。
@type struct<firebaseconfig>

*/

/*~struct~startfont:
@param fontface
@desc フォント名称です。他と同じものを使うときは空欄にしてください。

@param size
@desc フォントサイズです。
@default 52

@param bold
@desc 太字にしますか？
@type boolean
@on 太字にする
@off 太字にしない
@default false

@param italic
@desc 斜体にしますか？
@type boolean
@on 斜体にする
@off 斜体にしない
@default false

@param color
@desc フォントの色です。
*/

/*~struct~startse:
@param name
@desc ファイル名称です。
@type file
@dir /audio/se/

@param volume
@desc ボリュームの数値です。（0-100）
@type number
@min 0
@max 100
@default 90

@param pitch
@desc ピッチの数値です。（50-150）
@type number
@min 50
@max 150
@default 100

@param pan
@desc 位相（パン）の数値です。（-100-100）
@type number
@min -100
@max 100
@default 100

*/

/*~struct~firebaseconfig:
@param apiKey
@param authDomain
@param databaseURL
@param projectId
@param storageBucket
@param messagingSenderId
*/

(function() {
  var pluginName = 'SNZ_FirebaseSave';
  //=============================================================================
  // ユーザ書き換え領域 - 終了 -
  //=============================================================================

    var FirebaseSave = {};
    FirebaseSave._readytopushstart = false;
    FirebaseSave._readytonewgame = false;
    FirebaseSave._uid = "";
    FirebaseSave._islocalsave = false;
    FirebaseSave._savedata = "";
    FirebaseSave._app = null;

  //-----------------------------------------------------------------------------
  // パラメーターの受け取り
  var pluginName = 'SNZ_FirebaseSave';
  var _Scene_Base_start = Scene_Base.prototype.start;
  Scene_Base.prototype.start = function() {
    _Scene_Base_start.call(this);

  var paramParse = function(obj) {
      return JSON.parse(JSON.stringify(obj, paramReplace), paramRevive);
  };

  var paramReplace = function(key, value) {
      try {
          return JSON.parse(value || null);
      } catch (e) {
          return value;
      }
  };

  var paramRevive = function(key, value) {
      try {
        return eval(value || value);
      } catch (e) {
        return value;
      }
  };

  var parameters = PluginManager.parameters(pluginName);
  param = paramParse(parameters);

}


  //-----------------------------------------------------------------------------
  // Game_Interpreter_pluginCommand

  var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function(command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);
    if (command === 'FirebaseSave') {
      if ($gameSystem._saveEnabled) {
        FirebaseSaveManager.prototype.startToSave();
      }
    }
  };


  //-----------------------------------------------------------------------------
  // Scene_Title

  function getvars() {
    var arg = new Object;
    var pair = location.search.substring(1).split('&');
    for (var i = 0; pair[i]; i++) {
      var kv = pair[i].split('=');
      arg[kv[0]] = kv[1];
    }
    return arg;
  }

  var _Scene_TitleCreate = Scene_Title.prototype.create;
  Scene_Title.prototype.create = function() {
    _Scene_TitleCreate.apply(this, arguments);
    this._commandWindow.setHandler('cancel', this.onCancelCommand.bind(this));
    this.createGameStartSprite();
    this.onCancelCommand();
  };

  var _Scene_TitleUpdate = Scene_Title.prototype.update;
  Scene_Title.prototype.update = function() {
    _Scene_TitleUpdate.apply(this, arguments);
    this.updateNewGameOnly();
  };

  Scene_Title.prototype.updateNewGameOnly = function() {
    if (this._commandWindowClose) {
      this._commandWindow.openness -= 64;
    }
    if (!this._seledted && this.isTriggered() && FirebaseSave._readytopushstart) {
      //スタートを押した時実行
      this._gameStartSprite.visible = false;
      this._seledted = true;
      this.playStartSe();
      if (FirebaseSave._uid) {
        //ログイン済みの場合
        FirebaseSaveManager.prototype.fetchSavedTime();
      } else if (DataManager.isAnySavefileExists()) {
        //ローカルセーブがある場合はロード画面へ
        FirebaseSave._islocalsave = true;
        SceneManager.push(Scene_Load);
      } else {
        //ニューゲーム
        SceneManager.push(Scene_Newgameoption);
      }

    }
    //認証は完了しているがセーブデータがないとき（初回）
    if (FirebaseSave._readytonewgame) {
      FirebaseSave._readytonewgame = false;
      this.commandNewGame();
    }
    if (this._loadcomplete) {
      this._loadcomplete = false;
      this.onLoadSuccess();
      $gameSystem.onAfterLoad();
    }
  };
  Scene_Title.prototype.onLoadSuccess = Scene_Load.prototype.onLoadSuccess;
  Scene_Title.prototype.reloadMapIfUpdated = Scene_Load.prototype.reloadMapIfUpdated;

  Scene_Title.prototype.playStartSe = function() {
    var seName = param.startse.name;
    if (seName) {
      AudioManager.playSe(param.startse);
    } else {
      SoundManager.playOk();
    }
  };

  Scene_Title.prototype.onCancelCommand = function() {
    this._commandWindow.deactivate();
    this._seledted = false;
    this._gameStartSprite.visible = true;
    this._commandWindowClose = true;
    this._commandWindow.visible = false;
  };
  Scene_Title.prototype.createGameStartSprite = function() {
    this._gameStartSprite = new Sprite_GameStart();
    this._gameStartSprite.draw();
    this.addChild(this._gameStartSprite);
  };

  Scene_Title.prototype.isTriggered = function() {
    return Object.keys(Input.keyMapper).some(function(keyCode) {
        return Input.isTriggered(Input.keyMapper[keyCode]);
      }.bind(this)) ||
      Object.keys(Input.gamepadMapper).some(function(keyCode) {
        return Input.isTriggered(Input.gamepadMapper[keyCode]);
      }.bind(this)) || TouchInput.isTriggered();
  };

  //-----------------------------------------------------------------------------
  // Sprite_GameStart

  function Sprite_GameStart() {
    this.initialize.apply(this, arguments);
  }

  Sprite_GameStart.prototype = Object.create(Sprite_Base.prototype);
  Sprite_GameStart.prototype.constructor = Sprite_GameStart;

  Sprite_GameStart.prototype.initialize = function() {
    Sprite_Base.prototype.initialize.call(this);
    this.y = Graphics.height - 160;
    this.opacity_shift = -2;
  };

  Sprite_GameStart.prototype.draw = function() {
    var height = param.startfont.size;
    var text = param.starttext;
    this.bitmap = new Bitmap(Graphics.width, height);
    if (param.startfont.fontface) this.bitmap.fontFace = param.startfont.fontface;
    this.bitmap.fontSize = height;
    this.bitmap.fontItalic = param.startfont.italic;
    this.bitmap.fontBold = param.startfont.bold;
    this.bitmap.textColor = param.startfont.color;
    this.bitmap.drawText(text, 0, 0, Graphics.width, height, 'center');
  };

  Sprite_GameStart.prototype.update = function() {
    if (FirebaseSave._readytopushstart) {
      if (this.opacity < 128) {
        this.opacity = 255;
      }
      this.opacity += this.opacity_shift;
      if (this.opacity <= 128 || this.opacity >= 255) this.opacity_shift *= -1;
    } else {
      this.opacity = 0;
    }
  };


  //-----------------------------------------------------------------------------
  // Scene_Newgameoption

  function Scene_Newgameoption() {
    this.initialize.apply(this, arguments);
  }

  Scene_Newgameoption.prototype = Object.create(Scene_MenuBase.prototype);
  Scene_Newgameoption.prototype.constructor = Scene_Newgameoption;

  Scene_Newgameoption.prototype.initialize = function() {
    Scene_MenuBase.prototype.initialize.call(this);
  };

  Scene_Newgameoption.prototype.create = function() {
    Scene_MenuBase.prototype.create.call(this);
    this.createCommandWindow();
    this.createHelpWindow();
  };
  Scene_Newgameoption.prototype.createCommandWindow = function() {
    this._commandWindow = new Window_firebasenewgame();
    if(param.usetwitter){
      this._commandWindow.setHandler('twitterauth', this.commandTwitterauth.bind(this));
    }
    this._commandWindow.setHandler('googleauth', this.commandGoogleauth.bind(this));
    if(param.usefacebook){
      this._commandWindow.setHandler('facebookauth', this.commandFacebookauth.bind(this));
    }
    this._commandWindow.setHandler('noauth', this.commandNewGame.bind(this));
    this.addWindow(this._commandWindow);
  };
  Scene_Newgameoption.prototype.createHelpWindow = function() {
    this._helpWindow = new Window_firebasenewgamehelp(0, 0, Graphics.width, 150);
    this.addWindow(this._helpWindow);
    this._helpWindow.drawmessage();
  }

  Scene_Newgameoption.prototype.commandTwitterauth = function() {
    var provider = new firebase.auth.TwitterAuthProvider();
    firebase.auth().signInWithRedirect(provider);
  };
  Scene_Newgameoption.prototype.commandGoogleauth = function() {
    var provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithRedirect(provider);
  };
  Scene_Newgameoption.prototype.commandFacebookauth = function() {
    var provider = new firebase.auth.FacebookAuthProvider();
    firebase.auth().signInWithRedirect(provider);
  };
  Scene_Newgameoption.prototype.commandNewGame = function() {
    FirebaseSave._islocalsave = true;
    DataManager.setupNewGame();
    this._commandWindow.close();
    this.fadeOutAll();
    SceneManager.goto(Scene_Map);
  };

  Scene_Newgameoption.prototype.terminate = function() {
    Scene_Title.prototype.terminate.call(this);
  };


  //-----------------------------------------------------------------------------
  // Window_firebasenewgame

  function Window_firebasenewgame() {
    this.initialize.apply(this, arguments);
  }

  Window_firebasenewgame.prototype = Object.create(Window_Command.prototype);
  Window_firebasenewgame.prototype.constructor = Window_firebasenewgame;

  Window_firebasenewgame.prototype.windowWidth = function() {
    return 360;
  };
  Window_firebasenewgame.prototype.initialize = function() {
    Window_Command.prototype.initialize.call(this, 0, 0);
    this.x = (Graphics.width - this.windowWidth()) / 2;
    this.y = 300;
  };

  Window_firebasenewgame.prototype.makeCommandList = function() {
    Window_Command.prototype.makeCommandList.call(this);
    this.addCommand('Twitterアカウントと連携', 'twitterauth');
    this.addCommand('Googleアカウントと連携', 'googleauth');
    this.addCommand('Facebookアカウントと連携', 'facebookauth');
    this.addCommand('このブラウザでだけセーブ', 'noauth');
  };


  //-----------------------------------------------------------------------------
  // Window_firebasenewgamehelp

  function Window_firebasenewgamehelp() {
    this.initialize.apply(this, arguments);
  }

  Window_firebasenewgamehelp.prototype = Object.create(Window_Base.prototype);
  Window_firebasenewgamehelp.prototype.constructor = Window_firebasenewgamehelp;

  Window_firebasenewgamehelp.prototype.updatePadding = function() {
    this.padding = this.standardPadding() / 2;
  };
  Window_firebasenewgamehelp.prototype.drawmessage = function() {
    text = param.savedesc;
    text = text.replace(/<br>/g, '\n');
    this.drawTextEx(text, 10, 10);
  };


  //-----------------------------------------------------------------------------
  // Scene_Menu

  Scene_Menu.prototype.commandSave = function() {
    if (FirebaseSave._uid) {
      SceneManager.push(Scene_Firebasesave);
    } else {
      SceneManager.push(Scene_Save);
    }
  };


  //-----------------------------------------------------------------------------
  // Scene_Firebasesave

  function Scene_Firebasesave() {
    this.initialize.apply(this, arguments);
  }

  Scene_Firebasesave.prototype = Object.create(Scene_MenuBase.prototype);
  Scene_Firebasesave.prototype.constructor = Scene_Firebasesave;

  Scene_Firebasesave.prototype.initialize = function() {
    Scene_MenuBase.prototype.initialize.call(this);
  };

  Scene_Firebasesave.prototype.create = function() {
    Scene_MenuBase.prototype.create.call(this);
    this.createCommandWindow();
  };

  Scene_Firebasesave.prototype.terminate = function() {
    Scene_MenuBase.prototype.terminate.call(this);
  };

  Scene_Firebasesave.prototype.createCommandWindow = function() {
    this._commandWindow = new Window_firebasesave();
    this._commandWindow.setHandler('confirmfirebasesave', this.commandSave.bind(this));
    this._commandWindow.setHandler('logout', this.commandLogout.bind(this));
    this._commandWindow.setHandler('cancel', this.popScene.bind(this));
    this.addWindow(this._commandWindow);
  };

  Scene_Firebasesave.prototype.commandSave = function() {
    FirebaseSaveManager.prototype.startToSave();
    this.popScene();
  };

  Scene_Firebasesave.prototype.commandLogout = function() {
    firebase.auth().signOut().then(function() {
      SceneManager.goto(Scene_Title);
    }).catch(function(error) {
      throw new Error(error);
    });
  };


  //-----------------------------------------------------------------------------
  // Window_firebasesave

  function Window_firebasesave() {
    this.initialize.apply(this, arguments);
  }

  Window_firebasesave.prototype = Object.create(Window_Command.prototype);
  Window_firebasesave.prototype.constructor = Window_firebasesave;

  Window_firebasesave.prototype.initialize = function() {
    Window_Command.prototype.initialize.call(this, 0, 0);
    this.x = 300;
    this.y = 300;

  };

  Window_firebasesave.prototype.makeCommandList = function() {
    Window_Command.prototype.makeCommandList.call(this);
    this.addCommand('セーブ', 'confirmfirebasesave');
    this.addCommand('ログアウト', 'logout');
    this.addCommand('やめる', 'cancel');
  };


  //-----------------------------------------------------------------------------
  // DataManager

  DataManager.loadGameFromNetwork = function() {
    try {
      json = LZString.decompressFromBase64(FirebaseSave._savedata);
      this.createGameObjects();
      this.extractSaveContents(JsonEx.parse(json));
      this.selectSavefileForNewGame();
      return ('success');
    } catch (e) {
      return (e);
    }
  };


  //-----------------------------------------------------------------------------
  // Game_Temp_prototype_initialize

  var _Game_Temp_prototype_initialize = Game_Temp.prototype.initialize;
  Game_Temp.prototype.initialize = function() {
    _Game_Temp_prototype_initialize.call(this);
    if (this.isPlaytest()) {
      FirebaseSave._readytopushstart = true;
    } else {
      if (!FirebaseSave._app) {
        FirebaseSave._app = firebase.initializeApp(param.firebaseconfig);
      }
      firebase.auth().onAuthStateChanged(function(user) {
        FirebaseSave._readytopushstart = true;
        if (user) {
          FirebaseSave._uid = user.uid;
          FirebaseSaveManager.prototype.initConnection();
        } else {
          FirebaseSave._uid = "";
        }
      });
      firebase.auth().getRedirectResult().then(function(result) {
        FirebaseSave._readytopushstart = true;
        if (result.credential) {
          FirebaseSave._uid = result.user.uid;
          FirebaseSaveManager.prototype.initConnection();
        } else {
          FirebaseSave._uid = "";
        }
      }).catch(function(error) {
        throw new Error(error);
      });
    }
  }


  //-----------------------------------------------------------------------------
  // FirebaseSaveManager

  function FirebaseSaveManager() {
    throw new Error('this is static class.');
  }

  FirebaseSaveManager.prototype._loadcount = 0;
  FirebaseSaveManager.prototype._savedtimes = [];


  FirebaseSaveManager.prototype.initConnection = function() {
    if (!this._database) {
      this._database = firebase.database();
      this._storage = firebase.storage();
    }
  }

  FirebaseSaveManager.prototype.startToSave = function() {
    //セーブ中表記
    $gameScreen.showPicture(3, "saving", 0, 10, 690, 100, 100, 255, 0);
    if (FirebaseSave._islocalsave) {
      //ローカルの人はそのまま上書き
      var slotId = DataManager.lastAccessedSavefileId();
      $gameSystem.onBeforeSave();
      if (DataManager.saveGame(slotId)) {
        StorageManager.cleanBackup(slotId);
        $gameScreen.erasePicture(3);
      }
    } else {
      //記録するdateは「セーブコマンドを実行した」時点とします
      var date = new Date();
      var time = date.getTime();
      //セーブ処理の開始
      $gameSystem.onBeforeSave();
      this.postSaveData(time);
    }
  };

  FirebaseSaveManager.prototype.fetchSavedTime = function() {
    //最後にセーブしたタイムスタンプを取得する　失敗に備え5件まで
    var userRef = this._database.ref('user/' + FirebaseSave._uid).limitToLast(5);
    userRef.once('value').then(function(snapshot) {
      var result = snapshot.val();
      if (result) {
        //ロード
        var arr = Object.keys(result).map(function(key) {
          return result[key]
        });
        FirebaseSaveManager.prototype._savedtimes = arr.reverse();
        FirebaseSaveManager.prototype.fetchSaveData();
      } else {
        //セーブがまだないときはニューゲーム
        FirebaseSave._readytonewgame = true;
      }
    });
  }

  FirebaseSaveManager.prototype.fetchSaveData = function() {
    //前回セーブ時のタイムスタンプを元にセーブデータを取得
    var storageRef = this._storage.ref('user/' + FirebaseSave._uid + '/' + this._savedtimes[this._loadcount].time + '.rpgsave');
    storageRef.getDownloadURL().then(function(url) {
      var xhr = new XMLHttpRequest();
      xhr.responseType = 'text';
      xhr.onload = function(event) {
        FirebaseSave._savedata = xhr.response;
        FirebaseSaveManager.prototype.loadSaveData();
      };
      xhr.open('GET', url);
      xhr.send();
    }).catch(function(error) {
      //5回までデータを遡ってやり直す
      FirebaseSaveManager.prototype._loadcount++;
      if (FirebaseSaveManager.prototype._loadcount < 5) {
        FirebaseSaveManager.prototype.fetchSaveData();
      } else {
        throw new Error('セーブデータのロードに失敗しました。');
      }
    });


  }

  FirebaseSaveManager.prototype.loadSaveData = function() {
    //取得したセーブデータでゲームを起動する（DataManagerに渡す）
    var result = DataManager.loadGameFromNetwork();
    if (result === 'success') {
      this._loadcount = 0;
      Scene_Title.prototype._loadcomplete = true;
    } else {
      //5回までデータを遡ってやり直す
      this._loadcount++;
      if (this._loadcount < 5) {
        this.loadSaveData();
      } else {
        throw new Error('セーブデータのロードに失敗しました。');
      }
    }
  }

  FirebaseSaveManager.prototype.postSaveData = function(time) {
    var savedata = JsonEx.stringify(DataManager.makeSaveContents());
    var compressedsavedata = LZString.compressToBase64(savedata);
    var file = new Blob([compressedsavedata], {
      type: "text/plain"
    });
    var metadata = {
      contentType: 'text/plain'
    };
    if (!this._storageRef) {
      this._storageRef = firebase.storage().ref();
    }
    if (!FirebaseSave._uid) {
      FirebaseSave._uid = firebase.auth().currentUser.uid;
    }
    var uploadTask = this._storageRef.child('user/' + FirebaseSave._uid + '/' + time + '.rpgsave').put(file, metadata);
    uploadTask._time = time;
    uploadTask.on(firebase.storage.TaskEvent.STATE_CHANGED,
      function(snapshot) {},
      function(error) {
        console.log(error);
        console.log('オンラインセーブに失敗しました。ゲームは続行します。');
      },
      function() {
        //成功したらタイムスタンプを記録
        FirebaseSaveManager.prototype.postSavedTime(uploadTask._time);
        //古いセーブを消す
        FirebaseSaveManager.prototype.deleteOldSave();
      });
  }
  FirebaseSaveManager.prototype.postSavedTime = function(time) {
    //配列に記録
    this._savedtimes.unshift(time);
    //dbに記録
    var myref = this._database.ref('user/' + FirebaseSave._uid);
    var newPostKey = myref.push().key;
    var updates = {};
    updates[newPostKey] = {
      time: time
    };
    myref.update(updates);
  }

  FirebaseSaveManager.prototype.deleteOldSave = function() {
    //6こ以上セーブデータが溜まっていたら実行
    if (this._savedtimes[5]) {
      //配列の末尾のセーブデータを消す
      var storageRef = this._storage.ref('user/' + FirebaseSave._uid + '/' + this._savedtimes[this._savedtimes.length - 1].time + '.rpgsave');
      storageRef.delete().then(function() {
        console.log('古いセーブデータを削除しました。');
        $gameScreen.erasePicture(3);
      }).catch(function(error) {
        console.log(error);
        console.log('古いセーブデータの削除に失敗しました。ゲームは続行します。');
        $gameScreen.erasePicture(3);
      });
      //配列からも消す
      this._savedtimes.pop();
    } else {
      $gameScreen.erasePicture(3);
    }
  }

})();

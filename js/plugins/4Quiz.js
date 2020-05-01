//=============================================================================
// 4Quiz.js 2020.4.29
// The MIT License (MIT)
//=============================================================================

/*:
 * @plugindesc 4択クイズ用プラグイン
 * @author JayQ
 *
 * @param Start Val ID
 * @desc 変数範囲開始番号：変数n番（ここで指定した番号）からn+6番まで本プラグインで使用します。
 * @default 11
 * @type number
 *
 * @param Answer Switche ID
 * @desc 正解フラグ用スイッチ番号：本プラグインでは指定されたスイッチを出題時にOFF、正解時にONにします。
 * @default 21
 * @type number
 *
 * @param Csv File Path
 * @desc メッセージが記述されてるcsvファイルパス。ルートパスはdataフォルダになっています。
 * @default ExternMessage.csv
 * @type string
 * 
 * @help
 *      CSVファイルからクイズを出題するプラグインです。
 * 
 *      CSVファイルは以下のようなフォーマットにしてください。
 *          LV,問題,選択肢1,選択肢2,選択肢3,選択肢4,正解番号,解説文
 *          （例）
 *          1,JR香川駅は香川県にありません。何県にある？,愛媛県 ,高知県,徳島県,神奈川県,4,Wikipediaより
 *          1,"A word or phrase is missing in each of the sentences below. Four answer choices are given below each sentence. Select the best answer to complete the sentence.
 *          Customer reviews indicate that many modern mobile devices are often unnecessarily ------- .",complication,complicates,complicate,complicated,4,"The best answer to the question is choice 4.
 *          Therefore, you should choose answer 4."
 * 
 *      2行目のように、"で囲って改行（\n）を含めることもできます。（スプレッドシートの機能でCSV形式で保存時にそうしてくれると思います）
 * 
 * Plugin Command:
 *   4Quiz question 2             # LV2の問題を出題
 *   4Quiz answer                 # 結果表示
 * 
 */

 // CSVファイルのグローバルアクセス
 var $externMessageCSV = null;

 //---------------------------------------------------------------------------------------------
 // ExternMessage データーベース
 //---------------------------------------------------------------------------------------------
 var $externMessage =
 {
     // セットアップでデータを
     setup: function() {
         // // 改行コードを置き換え
         // $externMessageCSV = $externMessageCSV.replace("\r\n", "\n");
 
         // 2次元配列に変換
         this.map = CsvImportor.parseFromCSV($externMessageCSV);
 
     }
 };
 
 
 (function(_global) {
     // ここにプラグイン処理を記載
     var N = '4Quiz';
     var param = PluginManager.parameters(N);
     var startVal = Number(param['Start Val ID'])||11;
 
     // CSV関連
     var parameters = PluginManager.parameters('ExternMessage');
     $externMessage.CsvFilePath = String(param['Csv File Path']);
 
     // DataManagerへ読み込みの予約とセットアップの予約
     // DataManager._databaseFiles.push により、変数への取り込みを行う。（通常はjsonファイル）
     DataManager._databaseFiles.push({ name:'$externMessageCSV', src:$externMessage.CsvFilePath  });
 
     // ロードが完了したら呼ばれるように
     var _DataManager_setupNewGame = DataManager.setupNewGame;
     DataManager.setupNewGame = function() {
         _DataManager_setupNewGame.apply(this, arguments);
         $externMessage.setup();
     };
     // CSV関連 END
 
     // プラグインコマンド
     var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
     Game_Interpreter.prototype.pluginCommand = function(command, args) {
         _Game_Interpreter_pluginCommand.call(this, command, args);
         if (command == N) {
             if (args[0] == "start_val") {
 
                 startVal = args[1] || 11;
 
             } else if (args[0] == "question") {
 
                 // データ読み込み
                 var filteredMap = $externMessage.map
                 if (args[1]) {
                     filteredMap = $externMessage.map.filter(item => item[0] == args[1])
                 }
                 var maxID = filteredMap.length
                 var randNum = Math.floor(Math.random()*(maxID - 0) + 0);
                 var data =  filteredMap[randNum]
 
                 // 問題
                 $gameVariables.setValue(startVal, data[1])
                 //選択肢
                 $gameVariables.setValue(startVal + 1, data[2])
                 $gameVariables.setValue(startVal + 2, data[3])
                 $gameVariables.setValue(startVal + 3, data[4])
                 $gameVariables.setValue(startVal + 4, data[5])
                 // 正解番号
                 $gameVariables.setValue(startVal + 5, data[6])
                 // 解説文
                 $gameVariables.setValue(startVal + 6, data[7])
 
                 // 正解フラグ初期化
                 $gameSwitches.setValue(param['Answer Switche ID'], false)
 
                 // 出題の文章表示
                 $gameMessage.add($gameVariables.value(startVal))
 
                 // 選択肢の表示
                 this.setupChoices([
                     [$gameVariables.value(startVal + 1),
                     $gameVariables.value(startVal + 2),
                     $gameVariables.value(startVal + 3),
                     $gameVariables.value(startVal + 4) ],
                     4,0,2,0]);
                 this.setWaitMode('message');
 
             } else if (args[0] == "answer") {
 
                 if ($gameVariables.value(startVal + 5) == (this._branch[this._indent] + 1)) {
                     $gameSwitches.setValue(param['Answer Switche ID'], true)
                     $gameMessage.add('正解')
                 } else {
                     $gameMessage.add('不正解')
                 }
 
                 // 解説文表示
                 $gameMessage.add($gameVariables.value(startVal + 6))
             }
         }
     };
 
 })(this);
 
 
 //---------------------------------------------------------------------------------------------
 // CSV Helper
 //---------------------------------------------------------------------------------------------
 // CSVファイルから2次元配列にパースする
 var CsvImportor = 
 {
     parseFromCSV: function(text)
     {
         var result = new Array();
         var currentLine = new Array();
         var begin = 0;
         for(var index = 0; index < text.length; ++index)
         {
             var c = text[index];
             switch(c)
             {
                 case ',':
                     token = this.getToken(text, begin, index - begin);
                     currentLine.push(token);
                     begin = index + 1;
                     break;
                 case '"':
                     index = this.nextDoubleQuat(text, index + 1);
                     break;
                 case '\r':
                     token = this.getToken(text, begin, index - begin);
                     currentLine.push(token);
                     begin = index + 2;
                     result.push(currentLine);
                     currentLine = new Array();
                     break;
             }
         }
         return result;
     },
 
     // 文字トークンを抜き出す
     // \nで区切られる文字列が全角換算24文字を越える場合はさらに\n挿入
     getToken: function(text, begin, count) {
         var token
         if(text[begin] == '"') {
             token = text.substr(begin + 1, count - 2);
         } else {
             token = text.substr(begin, count);
         }
 
         token = this.cutString(token, 50)
 
         return token
     },
 
     // 次のダブルクォーテーションのインデックスを取得する
     nextDoubleQuat: function(text, index)
     {
         do {
             index = text.indexOf('"', index);
         } while(text[index - 1] == '\\');
         return index;
     },
 
     // 50バイトカット
     cutString: function(text, len)
     {
         String.prototype.bytes = function () {
             var length = 0;
             for (var i = 0; i < this.length; i++) {
               var c = this.charCodeAt(i);
               if ((c >= 0x0 && c < 0x81) || (c === 0xf8f0) || (c >= 0xff61 && c < 0xffa0) || (c >= 0xf8f1 && c < 0xf8f4)) {
                 length += 1;
               } else {
                 length += 2;
               }
             }
             return length;
         };
 
         var arr  = text.split("\n");
         var ret = ''
         for(let v of arr) {
             if (this.strLength(v) > len) {
                 v = this.multByteInsert(v, len, '\n');
                 v = this.cutString(v, len)
             }
             ret = ret.concat(v + '\n')
         }
         return ret.slice( 0, -1 ) ;
 
     },
     strLength: function( strSrc ){
         len = 0;
         strSrc = escape(strSrc);
         for(i = 0; i < strSrc.length; i++, len++){
             if(strSrc.charAt(i) == "%"){
                 if(strSrc.charAt(++i) == "u"){
                     i += 3;
                     len++;
                 }
                 i++;
             }
         }
         return len;
     },    
     multByteInsert: function( str , strLimit, insStr ){
 
         var isSlice = false;
         var cutStr = str
 
         while( this.strLength(cutStr) > strLimit ){
             cutStr = cutStr.slice(0, cutStr.length-1);
             isSlice = true;
         }
 
         if( isSlice ){
             str = cutStr + insStr + str.slice(cutStr.length)
         }
 
         return str;
     }
 };
 
 //---------------------------------------------------------------------------------------------
 // DataManager拡張
 //---------------------------------------------------------------------------------------------
 (function() {
     // 拡張子によって読み込むファイルを変更する
     const _DataManager_loadDataFile = DataManager.loadDataFile;
     DataManager.loadDataFile = function(name , src) {
         var extensionBegin = src.lastIndexOf('.');
         var extension = src.substr(extensionBegin, src.length - extensionBegin);
         if (extension == ".json") {
             _DataManager_loadDataFile.apply(this, arguments);
         } else {
             DataManager.loadCSVFile(name, src);
         }
     }
 
     // csv読み込み用拡張
     DataManager.loadCSVFile = function(name, src) {
         var xhr = new XMLHttpRequest();
         var url = 'data/' + src;
         xhr.open('GET', url);
         xhr.overrideMimeType('text/plain; charset=utf-8');
         xhr.onload = function() {
             if (xhr.status < 400) {
                 window[name] = xhr.responseText;
             }
         };
         xhr.onerror = this._mapLoader || function() {
             DataManager._errorUrl = DataManager._errorUrl || url;
         };
         window[name] = null;
         xhr.send();
     };
 })();
 
 
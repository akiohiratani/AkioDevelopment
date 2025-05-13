const express = require('express');
const path = require('path');
const { exec, spawn } = require('child_process');
const app = express();
const PORT = process.env.PORT || 3000;

// akio-local-engineのプロセス変数（グローバルに保持して後で終了できるようにする）
let flaskProcess;

// akio-local-engineを起動する関数
function startFlaskServer() {
  console.log('APIサーバー（akio-local-engine）を起動しています...');
  
  // コマンドプロンプトを表示せずにakio-local-engineを起動するオプション
  const options = {
    // 標準出力とエラー出力を親プロセスに表示
    stdio: 'inherit',
    // コマンドプロンプト（新しいウィンドウ）を表示しないためのオプション
    windowsHide: true,
    // シェルを使わない（これもウィンドウを表示しないために重要）
    shell: false
  };
  
  // akio-local-engineのプロセスを起動
  flaskProcess = spawn('./api/akio-local-engine', [], options);
  
  // エラーハンドリング
  flaskProcess.on('error', (err) => {
    console.error('akio-local-engineの起動に失敗しました:', err);
  });
  
  console.log('APIサーバー起動完了');
  
  // akio-local-engineの起動後にExpressサーバーを起動
  startExpressServer();
}

// Expressサーバーを起動する関数
function startExpressServer() {
  // 静的ファイルの提供
  app.use(express.static(path.join(__dirname, 'build')));
  
  // すべてのリクエストをindex.htmlに転送
  app.get('/*', function (req, res) {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
  
  // サーバー起動
  const server = app.listen(PORT, () => {
    console.log(`アプリケーションが http://localhost:${PORT} で起動しました`);
    // ブラウザを自動で開く
    exec(process.platform === 'win32' ? 
      `start http://localhost:${PORT}` : 
      (process.platform === 'darwin' ? 
        `open http://localhost:${PORT}` : 
        `xdg-open http://localhost:${PORT}`));
  });
  
  // プロセス終了時の処理を設定
  setupCleanupHandlers(server);
}

// プロセス終了時にakio-local-engineも終了させる処理を設定
function setupCleanupHandlers(server) {
  // SIGINT (Ctrl+C) などのシグナルを受け取ったときの処理
  const cleanupAndExit = () => {
    console.log('アプリケーションを終了しています...');
    
    // Expressサーバーを閉じる
    server.close(() => {
      console.log('Expressサーバーを終了しました');
      
      // akio-local-engineを終了
      if (flaskProcess) {
        // Windows環境ではkillが効かない場合があるので、taskkillコマンドも実行
        if (process.platform === 'win32') {
          exec(`taskkill /pid ${flaskProcess.pid} /f /t`, (error) => {
            if (error) {
              console.error('akio-local-engineの終了に失敗しました:', error);
            } else {
              console.log('akio-local-engineを終了しました');
            }
            process.exit(0);
          });
        } else {
          // Windows以外の環境
          flaskProcess.kill();
          console.log('akio-local-engineを終了しました');
          process.exit(0);
        }
      } else {
        process.exit(0);
      }
    });
  };
  
  // 各種終了シグナルを捕捉
  process.on('SIGINT', cleanupAndExit);
  process.on('SIGTERM', cleanupAndExit);
  
  // Windowsでの異常終了時
  if (process.platform === 'win32') {
    process.on('SIGBREAK', cleanupAndExit);
  }
  
  // 例外が発生した場合
  process.on('uncaughtException', (err) => {
    console.error('未処理の例外が発生しました:', err);
    cleanupAndExit();
  });
}

// akio-local-engineを先に起動
startFlaskServer();
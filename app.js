const express = require('express');
const path = require('path');
const { exec, spawn } = require('child_process');
const app = express();
const PORT = process.env.PORT || 3000;

// APIサーバーのプロセス変数（グローバルに保持して後で終了できるようにする）
let apiProcess;

// APIサーバーを起動する関数
function startAPIServer() {
  console.log('APIサーバーを起動しています...');
  
  // Windows か macOS かを判定
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  
  let command, args, options;
  
  if (isWindows) {
    // Windows環境
    command = './api/akio-local-engine.exe';
    args = [];
    options = {
      stdio: 'inherit',
      windowsHide: true,
      shell: false
    };
  } else if (isMac) {
    // macOS環境
    command = './api/akio-local-engine';  // macOS用の実行ファイル
    args = [];
    options = {
      stdio: 'inherit',
      shell: false
    };
  } else {
    console.error('サポートされていないOS環境です');
    process.exit(1);
  }
  
  // APIサーバープロセスを起動
  console.log(`APIサーバーを起動: ${command} ${args.join(' ')}`);
  apiProcess = spawn(command, args, options);
  
  // エラーハンドリング
  apiProcess.on('error', (err) => {
    console.error('APIサーバーの起動に失敗しました:', err);
    console.error('Expressサーバーのみを起動します...');
    startExpressServer();
  });
  
  // 正常に起動したらExpressサーバーを起動
  setTimeout(() => {
    console.log('APIサーバー起動完了');
    startExpressServer();
  }, 1000); // 1秒待機
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
    
    // ブラウザを自動で開く (Windows/macOS)
    if (process.platform === 'win32') {
      exec(`start http://localhost:${PORT}`);
    } else if (process.platform === 'darwin') {
      exec(`open http://localhost:${PORT}`);
    }
  });
  
  // プロセス終了時の処理を設定
  setupCleanupHandlers(server);
}

// プロセス終了時にAPIサーバーも終了させる処理を設定
function setupCleanupHandlers(server) {
  // SIGINT (Ctrl+C) などのシグナルを受け取ったときの処理
  const cleanupAndExit = () => {
    console.log('アプリケーションを終了しています...');
    
    // Expressサーバーを閉じる
    server.close(() => {
      console.log('Expressサーバーを終了しました');
      
      // APIサーバーを終了
      if (apiProcess) {
        if (process.platform === 'win32') {
          // Windows環境
          exec(`taskkill /pid ${apiProcess.pid} /f /t`, (error) => {
            if (error) {
              console.error('APIサーバーの終了に失敗しました:', error);
            } else {
              console.log('APIサーバーを終了しました');
            }
            process.exit(0);
          });
        } else if (process.platform === 'darwin') {
          // macOS環境
          apiProcess.kill('SIGTERM');
          console.log('APIサーバーを終了しました');
          process.exit(0);
        }
      } else {
        process.exit(0);
      }
    });
  };
  
  // 終了シグナルの捕捉
  process.on('SIGINT', cleanupAndExit);
  process.on('SIGTERM', cleanupAndExit);
  
  // Windows特有の終了シグナル
  if (process.platform === 'win32') {
    process.on('SIGBREAK', cleanupAndExit);
  }
  
  // 例外が発生した場合
  process.on('uncaughtException', (err) => {
    console.error('未処理の例外が発生しました:', err);
    cleanupAndExit();
  });
}

// APIサーバーを先に起動
startAPIServer();
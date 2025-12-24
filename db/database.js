const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'streamflow.db');

// Enable WAL mode for better concurrency and performance
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    // Enable WAL mode for better performance
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA synchronous = NORMAL');
    db.run('PRAGMA cache_size = 10000');
    db.run('PRAGMA temp_store = MEMORY');
  }
});

function createTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        avatar_path TEXT,
        gdrive_api_key TEXT,
        user_role TEXT DEFAULT 'admin',
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      
      // Videos table
      db.run(`CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        filepath TEXT NOT NULL,
        thumbnail_path TEXT,
        file_size INTEGER,
        duration REAL,
        format TEXT,
        resolution TEXT,
        bitrate INTEGER,
        fps TEXT,
        user_id TEXT,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`);
      
      // Streams table
      db.run(`CREATE TABLE IF NOT EXISTS streams (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        video_id TEXT,
        rtmp_url TEXT NOT NULL,
        stream_key TEXT NOT NULL,
        platform TEXT,
        platform_icon TEXT,
        bitrate INTEGER DEFAULT 2500,
        resolution TEXT,
        fps INTEGER DEFAULT 30,
        orientation TEXT DEFAULT 'horizontal',
        loop_video BOOLEAN DEFAULT 1,
        schedule_time TIMESTAMP,
        duration INTEGER,
        status TEXT DEFAULT 'offline',
        status_updated_at TIMESTAMP,
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        use_advanced_settings BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE SET NULL
      )`);
      
      // Stream history table
      db.run(`CREATE TABLE IF NOT EXISTS stream_history (
        id TEXT PRIMARY KEY,
        stream_id TEXT,
        title TEXT NOT NULL,
        platform TEXT,
        platform_icon TEXT,
        video_id TEXT,
        video_title TEXT,
        resolution TEXT,
        bitrate INTEGER,
        fps INTEGER,
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        duration INTEGER,
        use_advanced_settings BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (stream_id) REFERENCES streams(id) ON DELETE SET NULL,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE SET NULL
      )`);

      // Playlists table
      db.run(`CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        is_shuffle BOOLEAN DEFAULT 0,
        user_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`);

      // Playlist videos junction table
      db.run(`CREATE TABLE IF NOT EXISTS playlist_videos (
        id TEXT PRIMARY KEY,
        playlist_id TEXT NOT NULL,
        video_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
      )`);

      // Create indexes for better query performance
      db.run(`CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_streams_user_id ON streams(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_streams_status ON streams(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_streams_schedule_time ON streams(schedule_time)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_stream_history_user_id ON stream_history(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_stream_history_start_time ON stream_history(start_time)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON playlists(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_playlist_videos_playlist_id ON playlist_videos(playlist_id)`);
      
      // Add columns if they don't exist (migration support)
      db.run(`ALTER TABLE users ADD COLUMN user_role TEXT DEFAULT 'admin'`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error adding user_role column:', err.message);
        }
      });
      
      db.run(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error adding status column:', err.message);
        }
        resolve();
      });
    });
  });
}

function checkIfUsersExist() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM users', [], (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result.count > 0);
    });
  });
}

async function initializeDatabase() {
  await createTables();
  console.log('Database tables initialized successfully');
}

// Graceful shutdown handler
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});

module.exports = {
  db,
  checkIfUsersExist,
  initializeDatabase
};
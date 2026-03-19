#!/usr/bin/env node

const bcrypt = require('bcrypt');
const readline = require('readline');
const { initDatabase, getDatabase } = require('../src/config/database');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

async function main() {
  initDatabase();
  const db = getDatabase();

  const existing = db.prepare('SELECT username FROM admin_settings WHERE id = 1').get();

  console.log('');
  if (existing) {
    console.log(`현재 관리자: ${existing.username}`);
    console.log('Admin credentials update / 관리자 계정 변경');
  } else {
    console.log('Initial setup / 초기 설정');
  }
  console.log('========================================\n');

  const username = await question('Username / 아이디: ');
  if (!username) {
    console.log('Username is required.');
    rl.close();
    process.exit(1);
  }

  const password = await question('Password / 비밀번호: ');
  if (!password) {
    console.log('Password is required.');
    rl.close();
    process.exit(1);
  }

  const confirm = await question('Confirm password / 비밀번호 확인: ');
  if (password !== confirm) {
    console.log('Passwords do not match. / 비밀번호가 일치하지 않습니다.');
    rl.close();
    process.exit(1);
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    db.prepare(`
      INSERT INTO admin_settings (id, username, password_hash, updated_at)
      VALUES (1, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        password_hash = excluded.password_hash,
        updated_at = CURRENT_TIMESTAMP
    `).run(username, hash);

    console.log('\nAdmin credentials saved. / 관리자 계정이 설정되었습니다.');
    console.log('You can now log in. / 로그인할 수 있습니다.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }

  rl.close();
}

main();

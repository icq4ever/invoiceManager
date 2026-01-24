#!/usr/bin/env node

const bcrypt = require('bcrypt');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('비밀번호 해시 생성기');
console.log('====================\n');

rl.question('해시할 비밀번호를 입력하세요: ', async (password) => {
  if (!password) {
    console.log('비밀번호가 입력되지 않았습니다.');
    rl.close();
    return;
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    console.log('\n생성된 해시:');
    console.log(hash);
    console.log('\n.env 파일에 다음과 같이 설정하세요:');
    console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  } catch (err) {
    console.error('해시 생성 중 오류 발생:', err);
  }

  rl.close();
});

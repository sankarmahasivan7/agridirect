const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const frontendDir = path.resolve(__dirname, '..');
const androidDir = path.resolve(frontendDir, 'android');
const projectRootDir = path.resolve(frontendDir, '..');

const javaHome = process.env.JAVA_HOME || 'C:\\Program Files\\Java\\jdk-24';
const androidHome = process.env.ANDROID_HOME || 'C:\\Users\\sanka\\AppData\\Local\\Android\\Sdk';

console.log('==========================================');
console.log('AgriDirect Android APK Builder');
console.log('==========================================');
console.log(`JAVA_HOME:    ${javaHome}`);
console.log(`ANDROID_HOME: ${androidHome}`);
console.log(`Android Dir:  ${androidDir}`);

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidHome,
};

const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
console.log(`\nCompiling APK with Gradle: ${gradlew} assembleDebug...`);

const buildResult = spawnSync(gradlew, ['assembleDebug'], {
  cwd: androidDir,
  env,
  stdio: 'inherit',
  shell: true,
});

if (buildResult.status !== 0) {
  console.error('\n❌ Gradle APK assembly failed with exit code:', buildResult.status);
  process.exit(buildResult.status || 1);
}

const sourceApk = path.join(
  androidDir,
  'app',
  'build',
  'outputs',
  'apk',
  'debug',
  'app-debug.apk'
);

const targetApk = path.join(projectRootDir, 'AgriDirect.apk');

if (fs.existsSync(sourceApk)) {
  fs.copyFileSync(sourceApk, targetApk);
  const stats = fs.statSync(targetApk);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log('\n==========================================');
  console.log('✅ APK BUILD SUCCESSFUL!');
  console.log('==========================================');
  console.log(`Output APK:   ${targetApk}`);
  console.log(`File Size:    ${sizeMb} MB`);
  console.log('You can transfer this APK directly to your Android device to install.');
} else {
  console.error('❌ Could not locate compiled APK at:', sourceApk);
  process.exit(1);
}


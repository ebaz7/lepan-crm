import { execSync } from 'child_process';
import { existsSync, copyFileSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

console.log('====================================================');
console.log('   🤖 Android APK Build & Setup (Node.js Core) 🤖  ');
console.log('====================================================\n');

try {
    const isWindows = process.platform === 'win32';
    const gradleDir = join(process.cwd(), 'android');

    // 1. Build Web Assets
    console.log('📦 Step 1/4: Building Web Application (React + Vite)...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Web build finished successfully.\n');

    // 2. Sync with Capacitor
    console.log('🔄 Step 2/4: Syncing assets with Android project (Capacitor)...');
    execSync('npx cap sync android', { stdio: 'inherit' });
    console.log('✅ Capacitor assets synchronized.\n');

    // Auto-create local.properties if missing or invalid
    const localPropertiesPath = join(gradleDir, 'local.properties');
    let requiresWrite = !existsSync(localPropertiesPath);
    
    if (existsSync(localPropertiesPath)) {
        const content = readFileSync(localPropertiesPath, 'utf8');
        if (!content.includes('sdk.dir')) {
            requiresWrite = true;
        }
    }

    if (requiresWrite) {
        console.log('🔍 local.properties file needs configuration. System will attempt to locate Android SDK...');
        let sdkPath = '';
        if (isWindows) {
            const userSpecificSdk = 'C:\\Users\\Factorythird\\AppData\\Local\\Android\\Sdk';
            const defaultWinSdk = join(process.env.USERPROFILE || 'C:\\', 'AppData', 'Local', 'Android', 'Sdk');
            if (existsSync(userSpecificSdk)) {
                sdkPath = userSpecificSdk;
            } else if (existsSync(defaultWinSdk)) {
                sdkPath = defaultWinSdk;
            }
        } else if (process.platform === 'darwin') {
            const defaultMacSdk = join(process.env.HOME || '/', 'Library', 'Android', 'sdk');
            if (existsSync(defaultMacSdk)) {
                sdkPath = defaultMacSdk;
            }
        } else {
            const defaultLinuxSdk = join(process.env.HOME || '/', 'Android', 'Sdk');
            if (existsSync(defaultLinuxSdk)) {
                sdkPath = defaultLinuxSdk;
            }
        }

        if (sdkPath) {
            console.log(`✨ Found Android SDK at: ${sdkPath}`);
            const formattedPath = sdkPath.replace(/\\/g, '\\\\');
            writeFileSync(localPropertiesPath, `sdk.dir=${formattedPath}\n`);
            console.log('✅ Created android/local.properties file automatically.\n');
        } else {
            console.log('⚠️ Could not auto-detect default SDK location. You will need to configure ANDROID_HOME environment variable or build with Android Studio.\n');
        }
    }

    // 3. Assemble APK via Gradle
    console.log('⚙️  Step 3/4: Building Android APK using Gradle... (This may take a moment)');
    
    const gradlewName = isWindows ? 'gradlew.bat' : 'gradlew';
    const gradlewPath = join(gradleDir, gradlewName);

    let gradleCmd = '';
    if (existsSync(gradlewPath)) {
        gradleCmd = isWindows ? `gradlew.bat assembleDebug` : `./gradlew assembleDebug`;
    } else {
        console.log('ℹ️  Gradle wrapper not found, trying system gradle...');
        gradleCmd = 'gradle assembleDebug';
    }

    console.log(`🚀 Executing: ${gradleCmd} inside ./android`);
    
    // Execute gradle assembleDebug
    execSync(gradleCmd, { cwd: gradleDir, stdio: 'inherit' });
    console.log('✅ Gradle compilation finished.\n');

    // 4. Locating and copying APK to root
    console.log('📂 Step 4/4: Locating compiled APK file...');
    const defaultApkPath = join(gradleDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
    const rootApkPath = join(process.cwd(), 'payment-system-latest.apk');

    if (existsSync(defaultApkPath)) {
        copyFileSync(defaultApkPath, rootApkPath);
        console.log('====================================================');
        console.log('🎉 SUCCESS! APK BUILT SUCCESSFULLY! 🎉');
        console.log(`📁 Saved to: ${rootApkPath}`);
        console.log('====================================================');
    } else {
        console.warn('⚠️ Warning: APK build finished, but output file of app-debug.apk was not found in the default build directory.');
        console.log('Please check your Android Studio configuration or ./android build files.');
    }

} catch (error) {
    console.error('\n❌ Build failed with error:');
    console.error(error instanceof Error ? error.message : String(error));
    console.log('\n💡 Tip: Make sure JDK (Java Development Kit) 17 is installed on your machine and configured in your environment.');
    process.exit(1);
}

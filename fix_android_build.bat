@echo off
echo Fixing corrupted Android build files...

echo // Top-level build file>android\build.gradle
echo buildscript {>>android\build.gradle
echo     repositories { google(); mavenCentral() }>>android\build.gradle
echo     dependencies {>>android\build.gradle
echo         classpath 'com.android.tools.build:gradle:8.2.1'>>android\build.gradle
echo         classpath 'com.google.gms:google-services:4.4.0'>>android\build.gradle
echo     }>>android\build.gradle
echo }>>android\build.gradle
echo apply from: "variables.gradle">>android\build.gradle
echo allprojects { repositories { google(); mavenCentral() } }>>android\build.gradle
echo task clean(type: Delete) { delete rootProject.buildDir }>>android\build.gradle

echo include ':app'>android\settings.gradle
echo include ':capacitor-android'>>android\settings.gradle
echo project(':capacitor-android').projectDir = new File('../node_modules/@capacitor/android/capacitor')>>android\settings.gradle
echo include ':capacitor-cordova-android-plugins'>>android\settings.gradle
echo project(':capacitor-cordova-android-plugins').projectDir = new File('capacitor-cordova-android-plugins')>>android\settings.gradle

echo ext {>android\variables.gradle
echo     minSdkVersion = 22>>android\variables.gradle
echo     compileSdkVersion = 34>>android\variables.gradle
echo     targetSdkVersion = 34>>android\variables.gradle
echo     androidxActivityVersion = '1.8.0'>>android\variables.gradle
echo     androidxAppCompatVersion = '1.6.1'>>android\variables.gradle
echo     androidxCoordinatorLayoutVersion = '1.2.0'>>android\variables.gradle
echo     androidxCoreVersion = '1.12.0'>>android\variables.gradle
echo     androidxFragmentVersion = '1.6.2'>>android\variables.gradle
echo     junitVersion = '4.13.2'>>android\variables.gradle
echo     androidxJunitVersion = '1.1.5'>>android\variables.gradle
echo     androidxEspressoCoreVersion = '3.5.1'>>android\variables.gradle
echo     cordovaAndroidVersion = '10.1.1'>>android\variables.gradle
echo }>>android\variables.gradle

echo org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8>android\gradle.properties
echo android.useAndroidX=true>>android\gradle.properties
echo android.enableJetifier=true>>android\gradle.properties
echo kotlin.code.style=official>>android\gradle.properties

echo distributionBase=GRADLE_USER_HOME>android\gradle\wrapper\gradle-wrapper.properties
echo distributionPath=wrapper/dists>>android\gradle\wrapper\gradle-wrapper.properties
echo distributionUrl=https\://services.gradle.org/distributions/gradle-8.2.1-all.zip>>android\gradle\wrapper\gradle-wrapper.properties
echo zipStoreBase=GRADLE_USER_HOME>>android\gradle\wrapper\gradle-wrapper.properties
echo zipStorePath=wrapper/dists>>android\gradle\wrapper\gradle-wrapper.properties

echo apply plugin: 'com.android.application'>android\app\build.gradle
echo android {>>android\app\build.gradle
echo     namespace "com.payment.system">>android\app\build.gradle
echo     compileSdk rootProject.ext.compileSdkVersion>>android\app\build.gradle
echo     defaultConfig {>>android\app\build.gradle
echo         applicationId "com.payment.system">>android\app\build.gradle
echo         minSdk rootProject.ext.minSdkVersion>>android\app\build.gradle
echo         targetSdk rootProject.ext.targetSdkVersion>>android\app\build.gradle
echo         versionCode 1>>android\app\build.gradle
echo         versionName "1.0">>android\app\build.gradle
echo         testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner">>android\app\build.gradle
echo         aaptOptions { ignoreAssetsPattern "!.svn:!.git:!.ds_store:!*.scc:.*:g*.tbi:f*.tbi" }>>android\app\build.gradle
echo     }>>android\app\build.gradle
echo     buildTypes { release { minifyEnabled false; proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro' } }>>android\app\build.gradle
echo }>>android\app\build.gradle
echo repositories { flatDir { dirs 'libs' } }>>android\app\build.gradle
echo dependencies {>>android\app\build.gradle
echo     implementation fileTree(dir: 'libs', include: ['*.jar'])>>android\app\build.gradle
echo     implementation "androidx.appcompat:appcompat:$rootProject.ext.androidxAppCompatVersion">>android\app\build.gradle
echo     implementation "androidx.coordinatorlayout:coordinatorlayout:$rootProject.ext.androidxCoordinatorLayoutVersion">>android\app\build.gradle
echo     implementation "androidx.core:core:$rootProject.ext.androidxCoreVersion">>android\app\build.gradle
echo     implementation project(':capacitor-android')>>android\app\build.gradle
echo     implementation project(':capacitor-cordova-android-plugins')>>android\app\build.gradle
echo     testImplementation "junit:junit:$rootProject.ext.junitVersion">>android\app\build.gradle
echo     androidTestImplementation "androidx.test.ext:junit:$rootProject.ext.androidxJunitVersion">>android\app\build.gradle
echo     androidTestImplementation "androidx.test.espresso:espresso-core:$rootProject.ext.androidxEspressoCoreVersion">>android\app\build.gradle
echo }>>android\app\build.gradle
echo apply from: 'capacitor.build.gradle'>>android\app\build.gradle

echo [OK] Files regenerated. Now try build_apk.bat
pause

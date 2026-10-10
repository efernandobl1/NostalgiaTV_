plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "tv.nostalgia.android"
    compileSdk = 36
    buildToolsVersion = "36.0.0"

    defaultConfig {
        applicationId = "tv.nostalgia.android"
        minSdk = 23
        targetSdk = 36
        versionCode = providers.gradleProperty("versionCode").getOrElse("2").toInt()
        versionName = providers.gradleProperty("versionName").getOrElse("0.2.0")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "API_BASE_URL", "\"https://nostalgia-tv.work.gd/\"")
    }
    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            if (System.getenv("ANDROID_KEYSTORE_PATH") != null) {
                signingConfig = signingConfigs.create("production") {
                    storeFile = file(System.getenv("ANDROID_KEYSTORE_PATH"))
                    storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                    keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                    keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
                }
            }
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
        create("preview") {
            initWith(getByName("release"))
            applicationIdSuffix = ".preview"
            versionNameSuffix = "-preview"
            signingConfig = signingConfigs.getByName("debug")
            matchingFallbacks += "release"
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    testOptions { unitTests.isReturnDefaultValues = true }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2026.03.01"))
    implementation("androidx.activity:activity-compose:1.12.4")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.tv:tv-material:1.1.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.10.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.10.0")
    implementation("androidx.media3:media3-exoplayer:1.11.1")
    implementation("androidx.media3:media3-ui:1.11.1")
    implementation("androidx.media3:media3-session:1.11.1")
    implementation("androidx.media3:media3-datasource-okhttp:1.11.1")
    implementation("com.squareup.okhttp3:okhttp:5.3.2")
    implementation("io.coil-kt.coil3:coil-compose:3.3.0")
    implementation("io.coil-kt.coil3:coil-network-okhttp:3.3.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
    implementation("com.google.zxing:core:3.5.4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20250517")
    testImplementation("com.squareup.okhttp3:mockwebserver:5.3.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
    androidTestImplementation("androidx.test:runner:1.7.0")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test.uiautomator:uiautomator:2.3.0")
    androidTestImplementation("com.squareup.okhttp3:mockwebserver:5.3.2")
    androidTestImplementation("com.squareup.okhttp3:okhttp-tls:5.3.2")
    androidTestImplementation(platform("androidx.compose:compose-bom:2026.03.01"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}

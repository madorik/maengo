# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ---- 맹고(2026-11-07 R8 켬) ----
# 충돌 기록에 줄 번호를 남긴다(원래 파일 이름은 감춘다). Play에 mapping.txt를 같이 올려 원래 이름으로 본다
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
# 앱의 Capacitor 플러그인(MaengoMedia·MaengoReview·MaengoWidget)은 Capacitor 소비자 규칙(extends Plugin)이 지킨다.
# 웹뷰 다리(@JavascriptInterface)는 기본 규칙(proguard-android-optimize.txt)이 지킨다

# Capacitor 플러그인의 권한 선언(@CapacitorPlugin(permissions = @Permission(...)))을 R8이 지우지 않게(2026-11-11).
# 1.3.1(R8 처음 켬)에서 FirebaseMessaging.checkPermissions()가 빈 값을 돌려줘 알림 권한을 묻지도 등록하지도 못했다(안드로이드 기기 등록 0건).
# Capacitor 소비자 규칙은 플러그인 클래스만 지키고 주석(annotation) 형식은 지키지 않는다
-keepattributes RuntimeVisibleAnnotations,RuntimeVisibleParameterAnnotations,AnnotationDefault,*Annotation*
-keep @interface com.getcapacitor.annotation.** { *; }
-keep class com.getcapacitor.annotation.** { *; }

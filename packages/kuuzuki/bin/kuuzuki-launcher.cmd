@echo off
setlocal enabledelayedexpansion

if defined KUUZUKI_BIN_PATH (
    set "resolved=%KUUZUKI_BIN_PATH%"
) else (
    :: Determine platform package name
    set "platform=windows"
    
    :: Determine architecture
    if "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
        set "arch=x64"
    ) else if "%PROCESSOR_ARCHITECTURE%"=="ARM64" (
        set "arch=arm64"
    ) else (
        set "arch=x86"
    )
    
    set "name=kuuzuki-!platform!-!arch!"
    set "binary=kuuzuki.exe"
    
    :: Search for the binary
    set "resolved="
    set "search_dir=%~dp0"
    
    :search_loop
    if exist "!search_dir!node_modules\!name!\bin\!binary!" (
        set "resolved=!search_dir!node_modules\!name!\bin\!binary!"
        goto :found
    )
    
    :: Move up one directory
    for %%i in ("!search_dir!..") do set "search_dir=%%~fi\"
    
    :: Check if we've reached the root
    if "!search_dir!"=="!search_dir:~0,3!" goto :not_found
    
    goto :search_loop
    
    :not_found
    echo It seems that your package manager failed to install the right version of the kuuzuki CLI for your platform. >&2
    echo You can try manually installing the "!name!" package >&2
    exit /b 1
    
    :found
)

:: Execute the binary with all arguments
"%resolved%" %*
@echo off
setlocal
chcp 65001 >nul
set "ROOT=%~dp0"

set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" (
  echo [ERROR] Microsoft Edge not found.
  pause
  exit /b 1
)

set "APP_HTML=%ROOT%claimgate-oda-participation-application.preview.html"
set "PROP_HTML=%ROOT%claimgate-oda-product-service-proposal.preview.html"
set "PRIV_HTML=%ROOT%claimgate-oda-privacy-consent.preview.html"

copy /b "%ROOT%application-html-head.part"+"%ROOT%claimgate-oda-participation-application.md"+"%ROOT%application-html-tail.part" "%APP_HTML%" >nul
if errorlevel 1 goto BUILD_ERROR
copy /b "%ROOT%proposal-html-head.part"+"%ROOT%claimgate-oda-product-service-proposal.md"+"%ROOT%proposal-html-tail.part" "%PROP_HTML%" >nul
if errorlevel 1 goto BUILD_ERROR
copy /b "%ROOT%privacy-html-head.part"+"%ROOT%claimgate-oda-privacy-consent.md"+"%ROOT%privacy-html-tail.part" "%PRIV_HTML%" >nul
if errorlevel 1 goto BUILD_ERROR

set "APP_URL=file:///%APP_HTML:\=/%?v=%RANDOM%"
set "PROP_URL=file:///%PROP_HTML:\=/%?v=%RANDOM%"
set "PRIV_URL=file:///%PRIV_HTML:\=/%?v=%RANDOM%"
set "PROFILE=%TEMP%\claimgate-edge-export-%RANDOM%"

call :PRINT "%APP_URL%" "%ROOT%claimgate-oda-participation-application.pdf"
if errorlevel 1 goto EXPORT_ERROR
call :PRINT "%PROP_URL%" "%ROOT%claimgate-oda-product-service-proposal.pdf"
if errorlevel 1 goto EXPORT_ERROR
call :PRINT "%PRIV_URL%" "%ROOT%claimgate-oda-privacy-consent.pdf"
if errorlevel 1 goto EXPORT_ERROR

echo.
echo [OK] Three PDFs created from the current Markdown files:
echo   claimgate-oda-participation-application.pdf
echo   claimgate-oda-product-service-proposal.pdf
echo   claimgate-oda-privacy-consent.pdf
pause
exit /b 0

:PRINT
"%EDGE%" --headless --disable-gpu --disable-logging --log-level=3 --allow-file-access-from-files "--user-data-dir=%PROFILE%" --no-pdf-header-footer --print-to-pdf-no-header "--print-to-pdf=%~2" "%~1" 2>nul
if errorlevel 1 exit /b 1
if not exist "%~2" exit /b 1
exit /b 0

:BUILD_ERROR
echo [ERROR] Failed to build HTML from Markdown.
pause
exit /b 1

:EXPORT_ERROR
echo [ERROR] PDF export failed.
pause
exit /b 1

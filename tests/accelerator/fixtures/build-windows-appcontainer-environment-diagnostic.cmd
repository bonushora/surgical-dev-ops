@echo off
setlocal EnableExtensions

set "FIXTURE_ROOT=%~dp0"
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"

if not exist "%VSWHERE%" exit /b 2

for /f "usebackq tokens=*" %%I in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VSINSTALL=%%I"
if not defined VSINSTALL exit /b 3

call "%VSINSTALL%\VC\Auxiliary\Build\vcvars64.bat" >nul
if errorlevel 1 exit /b 4

pushd "%FIXTURE_ROOT%"
cl /nologo /std:c++17 /EHsc /O2 /W4 /WX /MT /utf-8 /DUNICODE /D_UNICODE windows-appcontainer-environment-diagnostic.cpp /Fo:windows-appcontainer-environment-diagnostic.obj /Fe:windows-appcontainer-environment-diagnostic.exe /link advapi32.lib userenv.lib
if errorlevel 1 goto compile_failed

if exist windows-appcontainer-environment-diagnostic.obj del /q windows-appcontainer-environment-diagnostic.obj
if not exist windows-appcontainer-environment-diagnostic.exe goto output_missing
popd

echo BUILT Windows AppContainer environment diagnostic with /W4 /WX /utf-8
exit /b 0

:compile_failed
if exist windows-appcontainer-environment-diagnostic.obj del /q windows-appcontainer-environment-diagnostic.obj
popd
exit /b 5

:output_missing
popd
exit /b 6

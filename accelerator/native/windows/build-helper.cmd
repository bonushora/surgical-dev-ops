@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
set "SOURCE=%ROOT%sdo-fs-durability.cpp"
set "OUTPUT=%ROOT%sdo-fs-durability.exe"
set "OBJECT=%ROOT%sdo-fs-durability.obj"
set "NODE_SOURCE=%ROOT%sdo-node-test-sandbox.cpp"
set "NODE_OUTPUT=%ROOT%sdo-node-test-sandbox.exe"
set "NODE_OBJECT=%ROOT%sdo-node-test-sandbox.obj"
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"

if not exist "%VSWHERE%" (
  echo ERROR: vswhere.exe not found. 1>&2
  exit /b 2
)

for /f "usebackq tokens=*" %%I in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VSINSTALL=%%I"

if not defined VSINSTALL (
  echo ERROR: Visual C++ build tools not found. 1>&2
  exit /b 3
)

call "%VSINSTALL%\VC\Auxiliary\Build\vcvars64.bat" >nul
if errorlevel 1 exit /b 4

cl /nologo /std:c++17 /EHsc /O2 /W4 /MT /utf-8 /DUNICODE /D_UNICODE "%SOURCE%" /Fo:"%OBJECT%" /Fe:"%OUTPUT%"
if errorlevel 1 exit /b 5

if exist "%OBJECT%" del /q "%OBJECT%"
if not exist "%OUTPUT%" exit /b 6

cl /nologo /std:c++17 /EHsc /O2 /W4 /WX /MT /utf-8 /DUNICODE /D_UNICODE "%NODE_SOURCE%" /Fo:"%NODE_OBJECT%" /Fe:"%NODE_OUTPUT%" /link advapi32.lib userenv.lib ole32.lib
if errorlevel 1 exit /b 7

if exist "%NODE_OBJECT%" del /q "%NODE_OBJECT%"
if not exist "%NODE_OUTPUT%" exit /b 8

set "KEY_SOURCE=%ROOT%sdo-private-key-acl.cpp"
set "KEY_OUTPUT=%ROOT%sdo-private-key-acl.exe"
set "KEY_OBJECT=%ROOT%sdo-private-key-acl.obj"
cl /nologo /std:c++17 /EHsc /O2 /W4 /WX /MT /utf-8 /DUNICODE /D_UNICODE "%KEY_SOURCE%" /Fo:"%KEY_OBJECT%" /Fe:"%KEY_OUTPUT%" /link advapi32.lib
if errorlevel 1 exit /b 9

if exist "%KEY_OBJECT%" del /q "%KEY_OBJECT%"
if not exist "%KEY_OUTPUT%" exit /b 10

echo BUILT %OUTPUT%, %NODE_OUTPUT%, and %KEY_OUTPUT%
exit /b 0

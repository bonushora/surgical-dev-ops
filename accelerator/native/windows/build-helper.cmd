@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
set "SOURCE=%ROOT%sdo-fs-durability.cpp"
set "OUTPUT=%ROOT%sdo-fs-durability.exe"
set "OBJECT=%ROOT%sdo-fs-durability.obj"
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

echo BUILT %OUTPUT%
exit /b 0

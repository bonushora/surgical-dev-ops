#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif

#include <windows.h>
#include <Aclapi.h>
#include <sddl.h>
#include <userenv.h>

#include <algorithm>
#include <cwchar>
#include <filesystem>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

#pragma comment(lib, "advapi32.lib")
#pragma comment(lib, "userenv.lib")

namespace fs = std::filesystem;

namespace {

constexpr DWORD kChildExit = 37;
constexpr DWORD kWaitMilliseconds = 30000;
constexpr wchar_t kChildArgument[] = L"--inert-child";

struct Entry {
  std::wstring name;
  std::wstring value;
};

struct Environment {
  std::vector<Entry> entries;
  std::vector<wchar_t> block;
};

struct EnvironmentMetadata {
  std::vector<std::string> names;
  size_t entryCount;
  size_t wcharCount;
  bool sorted;
  bool doubleNull;
};

struct VariantResult {
  bool createProcess;
  DWORD win32Error;
  const char* stage;
  bool hasChildExit;
  DWORD childExit;
};

struct ProfileEnvironmentMetadata {
  bool hasLocalAppData;
  bool tempProfileBound;
  bool tmpProfileBound;
  bool profileDirectoryExists;
  bool profileTempExists;
};

enum class AclAssessment {
  kAllowed,
  kDenied,
  kIndeterminate
};

struct PathMetadata {
  bool exists;
  const char* pathKind;
  const char* basename;
  const char* executableType;
  AclAssessment aclAssessment;
  DWORD aclDiagnosticCode;
};

struct DiagnosticFailure {
  const char* stage;
  DWORD win32Error;
};

const char* aclAssessmentName(AclAssessment assessment) {
  switch (assessment) {
    case AclAssessment::kAllowed: return "ALLOWED";
    case AclAssessment::kDenied: return "DENIED";
    case AclAssessment::kIndeterminate: return "INDETERMINATE";
  }
  return "INDETERMINATE";
}

DWORD win32CodeFromHresult(HRESULT value) {
  return static_cast<DWORD>(HRESULT_CODE(value));
}

int fail(const DiagnosticFailure& failure) {
  std::cerr << "WINDOWS_ENVIRONMENT_DIAGNOSTIC_FAILED"
            << " stage=" << failure.stage
            << " win32Error=" << failure.win32Error << '\n';
  return 2;
}

bool equalName(const std::wstring& left, const std::wstring& right) {
  return CompareStringOrdinal(
    left.c_str(), static_cast<int>(left.size()),
    right.c_str(), static_cast<int>(right.size()), TRUE
  ) == CSTR_EQUAL;
}

bool lessName(const Entry& left, const Entry& right) {
  return CompareStringOrdinal(
    left.name.c_str(), static_cast<int>(left.name.size()),
    right.name.c_str(), static_cast<int>(right.name.size()), TRUE
  ) == CSTR_LESS_THAN;
}

void setEntry(std::vector<Entry>* entries, const std::wstring& name,
              const std::wstring& value) {
  for (Entry& entry : *entries) {
    if (equalName(entry.name, name)) {
      entry.value = value;
      return;
    }
  }
  entries->push_back({name, value});
}

bool nativeValue(const void* environment, const std::wstring& requested,
                 std::wstring* value) {
  if (environment == nullptr || value == nullptr) return false;
  const auto* cursor = static_cast<const wchar_t*>(environment);
  while (*cursor != L'\0') {
    const std::wstring entry(cursor);
    const size_t separator = entry.find(L'=', entry.front() == L'=' ? 1u : 0u);
    if (separator != std::wstring::npos && separator > 0) {
      const std::wstring name = entry.substr(0, separator);
      if (equalName(name, requested)) {
        *value = entry.substr(separator + 1);
        return !value->empty();
      }
    }
    cursor += entry.size() + 1;
  }
  return false;
}

bool addDriveEntry(std::vector<Entry>* entries, const std::wstring& confinedRoot) {
  const std::wstring drive = fs::path(confinedRoot).root_name().wstring();
  if (drive.size() != 2 || drive[1] != L':') return false;
  setEntry(entries, L"=" + drive, confinedRoot);
  return true;
}

Environment serialize(std::vector<Entry> entries) {
  std::sort(entries.begin(), entries.end(), lessName);
  std::vector<wchar_t> block;
  for (const Entry& entry : entries) {
    const std::wstring serialized = entry.name + L"=" + entry.value;
    block.insert(block.end(), serialized.begin(), serialized.end());
    block.push_back(L'\0');
  }
  block.push_back(L'\0');
  return {std::move(entries), std::move(block)};
}

Environment profileEnvironment(const Environment& base, const std::wstring& profile,
                               bool bindTemp) {
  std::vector<Entry> entries = base.entries;
  setEntry(&entries, L"LOCALAPPDATA", profile);
  if (bindTemp) {
    const std::wstring temp = (fs::path(profile) / L"Temp").wstring();
    setEntry(&entries, L"TEMP", temp);
    setEntry(&entries, L"TMP", temp);
  }
  return serialize(std::move(entries));
}

bool environmentSorted(const Environment& environment) {
  return std::is_sorted(
    environment.entries.begin(), environment.entries.end(), lessName
  );
}

bool environmentDoubleNull(const Environment& environment) {
  return environment.block.size() >= 2 &&
    environment.block[environment.block.size() - 1] == L'\0' &&
    environment.block[environment.block.size() - 2] == L'\0';
}

bool environmentWellFormed(const Environment& environment) {
  if (!environmentDoubleNull(environment) || environment.entries.empty()) return false;
  for (size_t index = 0; index < environment.entries.size(); ++index) {
    const Entry& entry = environment.entries[index];
    if (entry.name.empty() || entry.value.empty()) return false;
    if (entry.name.front() != L'=' && entry.name.find(L'=') != std::wstring::npos) {
      return false;
    }
    if (index > 0 && equalName(environment.entries[index - 1].name, entry.name)) {
      return false;
    }
  }
  return environmentSorted(environment);
}

bool manualCurrentEnvironment(const std::wstring& confinedWorkspace,
                              const std::wstring& fixedPath,
                              Environment* environment,
                              DiagnosticFailure* failure) {
  wchar_t windowsDirectory[MAX_PATH]{};
  const UINT length = GetWindowsDirectoryW(windowsDirectory, MAX_PATH);
  if (length == 0 || length >= MAX_PATH) {
    *failure = {
      "manual-system-root", length == 0 ? GetLastError() : ERROR_INSUFFICIENT_BUFFER
    };
    return false;
  }
  std::vector<Entry> entries{
    {L"HOME", confinedWorkspace},
    {L"PATH", fixedPath},
    {L"SystemRoot", std::wstring(windowsDirectory)},
    {L"TEMP", confinedWorkspace},
    {L"TMP", confinedWorkspace}
  };
  if (!addDriveEntry(&entries, confinedWorkspace)) {
    *failure = {"manual-drive-entry", ERROR_INVALID_DRIVE};
    return false;
  }
  *environment = serialize(std::move(entries));
  return environmentWellFormed(*environment);
}

bool nativeSanitizedEnvironment(HANDLE token,
                                const std::wstring& confinedWorkspace,
                                const std::wstring& fixedPath,
                                bool includeOptionalSystemEntries,
                                Environment* environment,
                                DiagnosticFailure* failure) {
  void* nativeEnvironment = nullptr;
  const BOOL created = CreateEnvironmentBlock(&nativeEnvironment, token, FALSE);
  const DWORD createError = created ? ERROR_SUCCESS : GetLastError();
  if (!created || nativeEnvironment == nullptr) {
    *failure = {token == nullptr ? "minimal-native-create" : "native-create", createError};
    return false;
  }

  std::vector<Entry> entries;
  std::wstring systemRoot;
  if (!nativeValue(nativeEnvironment, L"SystemRoot", &systemRoot)) {
    const BOOL destroyed = DestroyEnvironmentBlock(nativeEnvironment);
    const DWORD destroyError = destroyed ? ERROR_SUCCESS : GetLastError();
    *failure = {
      token == nullptr ? "minimal-native-system-root" : "native-system-root",
      destroyed ? ERROR_ENVVAR_NOT_FOUND : destroyError
    };
    return false;
  }
  setEntry(&entries, L"SystemRoot", systemRoot);

  if (includeOptionalSystemEntries) {
    std::wstring value;
    if (nativeValue(nativeEnvironment, L"windir", &value)) {
      setEntry(&entries, L"windir", value);
    }
    value.clear();
    if (nativeValue(nativeEnvironment, L"ComSpec", &value)) {
      setEntry(&entries, L"ComSpec", value);
    }
  }

  const BOOL destroyed = DestroyEnvironmentBlock(nativeEnvironment);
  const DWORD destroyError = destroyed ? ERROR_SUCCESS : GetLastError();
  if (!destroyed) {
    *failure = {
      token == nullptr ? "minimal-native-destroy" : "native-destroy", destroyError
    };
    return false;
  }

  setEntry(&entries, L"HOME", confinedWorkspace);
  setEntry(&entries, L"PATH", fixedPath);
  setEntry(&entries, L"TEMP", confinedWorkspace);
  setEntry(&entries, L"TMP", confinedWorkspace);
  if (!addDriveEntry(&entries, confinedWorkspace)) {
    *failure = {
      token == nullptr ? "minimal-native-drive-entry" : "native-drive-entry",
      ERROR_INVALID_DRIVE
    };
    return false;
  }
  *environment = serialize(std::move(entries));
  return environmentWellFormed(*environment);
}

bool grantAppContainerReadExecute(const std::wstring& root, PSID sid,
                                  PSECURITY_DESCRIPTOR* oldDescriptor,
                                  PACL* oldDacl, DiagnosticFailure* failure) {
  DWORD result = GetNamedSecurityInfoW(
    const_cast<LPWSTR>(root.c_str()), SE_FILE_OBJECT, DACL_SECURITY_INFORMATION,
    nullptr, nullptr, oldDacl, nullptr, oldDescriptor
  );
  if (result != ERROR_SUCCESS) {
    *failure = {"dacl-read", result};
    return false;
  }

  EXPLICIT_ACCESSW entries[2]{};
  entries[0].grfAccessPermissions = GENERIC_READ | GENERIC_EXECUTE;
  entries[0].grfAccessMode = SET_ACCESS;
  entries[0].grfInheritance = SUB_CONTAINERS_AND_OBJECTS_INHERIT;
  entries[0].Trustee.TrusteeForm = TRUSTEE_IS_SID;
  entries[0].Trustee.ptstrName = reinterpret_cast<LPWSTR>(sid);
  entries[1] = entries[0];
  entries[1].grfAccessPermissions = GENERIC_WRITE | DELETE | FILE_DELETE_CHILD;
  entries[1].grfAccessMode = DENY_ACCESS;

  PACL updated = nullptr;
  result = SetEntriesInAclW(2, entries, *oldDacl, &updated);
  if (result != ERROR_SUCCESS) {
    *failure = {"dacl-compose", result};
    return false;
  }
  result = SetNamedSecurityInfoW(
    const_cast<LPWSTR>(root.c_str()), SE_FILE_OBJECT, DACL_SECURITY_INFORMATION,
    nullptr, nullptr, updated, nullptr
  );
  if (updated != nullptr) LocalFree(updated);
  if (result != ERROR_SUCCESS) {
    *failure = {"dacl-apply", result};
    return false;
  }
  return true;
}

bool restoreDacl(const std::wstring& root, PSECURITY_DESCRIPTOR descriptor,
                 PACL dacl, DiagnosticFailure* failure) {
  if (descriptor == nullptr) {
    *failure = {"dacl-restore", ERROR_INVALID_DATA};
    return false;
  }
  const DWORD result = SetNamedSecurityInfoW(
    const_cast<LPWSTR>(root.c_str()), SE_FILE_OBJECT, DACL_SECURITY_INFORMATION,
    nullptr, nullptr, dacl, nullptr
  );
  if (result != ERROR_SUCCESS) {
    *failure = {"dacl-restore", result};
    return false;
  }
  return true;
}

bool validateAppContainerPath(const std::wstring& path, bool expectDirectory,
                              const char* basename, PSID sid,
                              PathMetadata* metadata,
                              DiagnosticFailure* failure) {
  const DWORD attributes = GetFileAttributesW(path.c_str());
  const DWORD attributeError =
    attributes == INVALID_FILE_ATTRIBUTES ? GetLastError() : ERROR_SUCCESS;
  const bool exists = attributes != INVALID_FILE_ATTRIBUTES;
  const bool isDirectory = exists && (attributes & FILE_ATTRIBUTE_DIRECTORY) != 0;
  *metadata = {
    exists, expectDirectory ? "directory" : "file", basename,
    expectDirectory ? "directory" : "regular-file",
    AclAssessment::kIndeterminate,
    exists ? ERROR_SUCCESS : attributeError
  };
  if (!exists || isDirectory != expectDirectory) {
    *failure = {
      expectDirectory ? "current-directory-validate" : "executable-validate",
      exists ? ERROR_DIRECTORY : attributeError
    };
    return false;
  }
  if (!expectDirectory && (attributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0) {
    *failure = {"executable-validate", ERROR_REPARSE_TAG_INVALID};
    return false;
  }

  PSECURITY_DESCRIPTOR descriptor = nullptr;
  PACL dacl = nullptr;
  const DWORD securityError = GetNamedSecurityInfoW(
    const_cast<LPWSTR>(path.c_str()), SE_FILE_OBJECT, DACL_SECURITY_INFORMATION,
    nullptr, nullptr, &dacl, nullptr, &descriptor
  );
  if (securityError != ERROR_SUCCESS || dacl == nullptr) {
    if (descriptor != nullptr) LocalFree(descriptor);
    metadata->aclAssessment = AclAssessment::kIndeterminate;
    metadata->aclDiagnosticCode =
      securityError == ERROR_SUCCESS ? ERROR_INVALID_ACL : securityError;
    return true;
  }

  TRUSTEEW trustee{};
  BuildTrusteeWithSidW(&trustee, sid);
  ACCESS_MASK rights = 0;
  const DWORD rightsError = GetEffectiveRightsFromAclW(dacl, &trustee, &rights);
  LocalFree(descriptor);
  if (rightsError != ERROR_SUCCESS) {
    metadata->aclAssessment = AclAssessment::kIndeterminate;
    metadata->aclDiagnosticCode = rightsError;
    return true;
  }
  GENERIC_MAPPING fileMapping{
    FILE_GENERIC_READ, FILE_GENERIC_WRITE, FILE_GENERIC_EXECUTE, FILE_ALL_ACCESS
  };
  MapGenericMask(&rights, &fileMapping);
  const ACCESS_MASK required = FILE_GENERIC_READ | FILE_GENERIC_EXECUTE;
  metadata->aclAssessment = (rights & required) == required
    ? AclAssessment::kAllowed : AclAssessment::kIndeterminate;
  metadata->aclDiagnosticCode = metadata->aclAssessment == AclAssessment::kAllowed
    ? ERROR_SUCCESS : ERROR_ACCESS_DENIED;
  return true;
}

std::wstring quote(const std::wstring& value) {
  return L"\"" + value + L"\"";
}

VariantResult runVariant(const std::wstring& executable,
                         const wchar_t* currentDirectory,
                         const Environment& environment,
                         LPPROC_THREAD_ATTRIBUTE_LIST attributes,
                         HANDLE job, bool explicitApplicationName = true) {
  std::wstring command = quote(executable) + L" " + kChildArgument;
  std::vector<wchar_t> commandLine(command.begin(), command.end());
  commandLine.push_back(L'\0');

  STARTUPINFOEXW startup{};
  startup.StartupInfo.cb = sizeof(startup);
  startup.lpAttributeList = attributes;
  PROCESS_INFORMATION process{};
  const BOOL created = CreateProcessW(
    explicitApplicationName ? executable.c_str() : nullptr,
    commandLine.data(), nullptr, nullptr, FALSE,
    CREATE_SUSPENDED | CREATE_UNICODE_ENVIRONMENT | EXTENDED_STARTUPINFO_PRESENT,
    const_cast<wchar_t*>(environment.block.data()), currentDirectory,
    &startup.StartupInfo, &process
  );
  const DWORD createError = created ? ERROR_SUCCESS : GetLastError();
  if (!created) {
    return {false, createError, "process-create", false, 0};
  }

  if (!AssignProcessToJobObject(job, process.hProcess)) {
    const DWORD error = GetLastError();
    TerminateProcess(process.hProcess, ERROR_ACCESS_DENIED);
    WaitForSingleObject(process.hProcess, INFINITE);
    CloseHandle(process.hThread);
    CloseHandle(process.hProcess);
    return {true, error, "job-assign", false, 0};
  }
  if (ResumeThread(process.hThread) == static_cast<DWORD>(-1)) {
    const DWORD error = GetLastError();
    TerminateJobObject(job, ERROR_ACCESS_DENIED);
    WaitForSingleObject(process.hProcess, INFINITE);
    CloseHandle(process.hThread);
    CloseHandle(process.hProcess);
    return {true, error, "process-resume", false, 0};
  }

  const DWORD wait = WaitForSingleObject(process.hProcess, kWaitMilliseconds);
  if (wait != WAIT_OBJECT_0) {
    const DWORD error = wait == WAIT_FAILED ? GetLastError() : WAIT_TIMEOUT;
    TerminateJobObject(job, error);
    WaitForSingleObject(process.hProcess, INFINITE);
    CloseHandle(process.hThread);
    CloseHandle(process.hProcess);
    return {true, error, wait == WAIT_TIMEOUT ? "process-timeout" : "process-wait", false, 0};
  }

  DWORD childExit = 0;
  if (!GetExitCodeProcess(process.hProcess, &childExit)) {
    const DWORD error = GetLastError();
    CloseHandle(process.hThread);
    CloseHandle(process.hProcess);
    return {true, error, "process-exit", false, 0};
  }
  CloseHandle(process.hThread);
  CloseHandle(process.hProcess);
  return {true, ERROR_SUCCESS, "complete", true, childExit};
}

std::string safeName(const std::wstring& name) {
  std::string result;
  for (const wchar_t character : name) {
    if (!((character >= L'A' && character <= L'Z') ||
          (character >= L'a' && character <= L'z') ||
          (character >= L'0' && character <= L'9') ||
          character == L'_' || character == L'=' || character == L':')) {
      return "INVALID_NAME";
    }
    result.push_back(static_cast<char>(character));
  }
  return result;
}

EnvironmentMetadata metadata(const Environment& environment) {
  std::vector<std::string> names;
  for (const Entry& entry : environment.entries) names.push_back(safeName(entry.name));
  return {
    std::move(names), environment.entries.size(), environment.block.size(),
    environmentSorted(environment), environmentDoubleNull(environment)
  };
}

void reportVariant(const char* variant, const char* source,
                   const EnvironmentMetadata& environment,
                   const VariantResult& result) {
  std::cout << "variant=" << variant
            << " environmentSource=" << source
            << " entryNames=[";
  for (size_t index = 0; index < environment.names.size(); ++index) {
    if (index != 0) std::cout << ',';
    std::cout << environment.names[index];
  }
  std::cout << "] entryCount=" << environment.entryCount
            << " wcharCount=" << environment.wcharCount
            << " sorted=" << (environment.sorted ? "true" : "false")
            << " doubleNull=" << (environment.doubleNull ? "true" : "false")
            << " createProcess=" << (result.createProcess ? "PASS" : "FAIL")
            << " win32Error=" << result.win32Error
            << " stage=" << result.stage
            << " childExit=";
  if (result.hasChildExit) std::cout << result.childExit;
  else std::cout << "null";
  std::cout << '\n';
}

void reportProfileVariant(const char* variant, const Environment& environment,
                          const ProfileEnvironmentMetadata& profile,
                          const VariantResult& result, bool cleanup) {
  const EnvironmentMetadata meta = metadata(environment);
  std::cout << "variant=" << variant << " environmentSource=profile-"
            << (profile.tempProfileBound ? "complete" :
                (profile.hasLocalAppData ? "localappdata" : "native-sanitized"))
            << " entryNames=[";
  for (size_t index = 0; index < meta.names.size(); ++index) {
    if (index != 0) std::cout << ',';
    std::cout << meta.names[index];
  }
  std::cout << "] hasLocalAppData=" << (profile.hasLocalAppData ? "true" : "false")
            << " tempProfileBound=" << (profile.tempProfileBound ? "true" : "false")
            << " tmpProfileBound=" << (profile.tmpProfileBound ? "true" : "false")
            << " profileDirectoryExists="
            << (profile.profileDirectoryExists ? "true" : "false")
            << " profileTempExists=" << (profile.profileTempExists ? "true" : "false")
            << " createProcess=" << (result.createProcess ? "PASS" : "FAIL")
            << " win32Error=" << result.win32Error << " stage=" << result.stage
            << " childExit=";
  if (result.hasChildExit) std::cout << result.childExit;
  else std::cout << "null";
  std::cout << " cleanup=" << (cleanup ? "PASS" : "FAIL") << '\n';
}

void reportArgumentVariant(const char* variant, const char* currentDirectoryMode,
                           const PathMetadata& executable,
                           const PathMetadata& currentDirectory,
                           const VariantResult& result, bool cleanup,
                           bool explicitApplicationName = true) {
  std::cout << "variant=" << variant
            << " applicationNameMode="
            << (explicitApplicationName ? "absolute" : "null")
            << " executablePathKind=" << executable.pathKind
            << " executableExists=" << (executable.exists ? "true" : "false")
            << " executableType=" << executable.executableType
            << " aclAssessment=" << aclAssessmentName(executable.aclAssessment)
            << " aclDiagnosticCode=" << executable.aclDiagnosticCode
            << " executableBasename=" << executable.basename
            << " commandLineMode="
            << (explicitApplicationName ? "explicit-separated" : "quoted-first-token")
            << " argcExpected=2"
            << " currentDirectoryMode=" << currentDirectoryMode
            << " currentDirectoryPathKind=" << currentDirectory.pathKind
            << " currentDirectoryExists="
            << (currentDirectory.exists ? "true" : "false")
            << " currentDirectoryAclAssessment="
            << aclAssessmentName(currentDirectory.aclAssessment)
            << " currentDirectoryBasename=" << currentDirectory.basename
            << " environmentSource=native-sanitized"
            << " appContainer=true"
            << " creationFlags=CREATE_SUSPENDED|CREATE_UNICODE_ENVIRONMENT|"
               "EXTENDED_STARTUPINFO_PRESENT"
            << " startupInfoExBytes=" << sizeof(STARTUPINFOEXW)
            << " securityCapabilities=true"
            << " attributeListValid=true"
            << " creationToken=calling-process"
            << " createProcess=" << (result.createProcess ? "PASS" : "FAIL")
            << " win32Error=" << result.win32Error
            << " stage=" << result.stage
            << " childExit=";
  if (result.hasChildExit) std::cout << result.childExit;
  else std::cout << "null";
  std::cout << " cleanup=" << (cleanup ? "PASS" : "FAIL") << '\n';
}

}  // namespace

int wmain(int argc, wchar_t* argv[]) {
  if (argc == 2 && std::wcscmp(argv[1], kChildArgument) == 0) {
    return static_cast<int>(kChildExit);
  }
  if (argc != 1) return fail({"arguments", ERROR_BAD_ARGUMENTS});

  wchar_t modulePath[MAX_PATH]{};
  const DWORD moduleLength = GetModuleFileNameW(nullptr, modulePath, MAX_PATH);
  if (moduleLength == 0 || moduleLength >= MAX_PATH) {
    return fail({
      "module", moduleLength == 0 ? GetLastError() : ERROR_INSUFFICIENT_BUFFER
    });
  }

  std::error_code filesystemError;
  const fs::path stage = fs::temp_directory_path(filesystemError) /
    (L"sdo-environment-diagnostic-" + std::to_wstring(GetCurrentProcessId()));
  if (filesystemError || !fs::create_directory(stage, filesystemError) || filesystemError) {
    const DWORD error = filesystemError
      ? static_cast<DWORD>(filesystemError.value()) : ERROR_ALREADY_EXISTS;
    return fail({"staging-create", error});
  }
  const fs::path stagedWorkspace = stage / L"workspace";
  const fs::path stagedExecutableDirectory = stage / L"node";
  if (!fs::create_directory(stagedWorkspace, filesystemError) || filesystemError ||
      !fs::create_directory(stagedExecutableDirectory, filesystemError) || filesystemError) {
    const DWORD error = filesystemError
      ? static_cast<DWORD>(filesystemError.value()) : ERROR_ALREADY_EXISTS;
    std::error_code cleanupError;
    fs::remove_all(stage, cleanupError);
    return fail({"staging-layout", error});
  }
  const fs::path stagedExecutable =
    stagedExecutableDirectory / L"environment-diagnostic.exe";
  if (!fs::copy_file(
      fs::path(modulePath), stagedExecutable, fs::copy_options::none, filesystemError) ||
      filesystemError) {
    const DWORD error = filesystemError
      ? static_cast<DWORD>(filesystemError.value()) : ERROR_CANNOT_COPY;
    std::error_code cleanupError;
    fs::remove_all(stage, cleanupError);
    return fail({"staging-copy", error});
  }

  const std::wstring profileName =
    L"SdoEnvironmentDiagnostic-" + std::to_wstring(GetCurrentProcessId());
  PSID sid = nullptr;
  const HRESULT profileResult = CreateAppContainerProfile(
    profileName.c_str(), L"SDO environment diagnostic", L"SDO environment diagnostic",
    nullptr, 0, &sid
  );
  if (FAILED(profileResult) || sid == nullptr) {
    fs::remove_all(stage, filesystemError);
    return fail({"appcontainer-profile", win32CodeFromHresult(profileResult)});
  }

  LPWSTR sidText = nullptr;
  if (!ConvertSidToStringSidW(sid, &sidText)) {
    const DWORD sidError = GetLastError();
    DeleteAppContainerProfile(profileName.c_str());
    FreeSid(sid);
    fs::remove_all(stage, filesystemError);
    return fail({"appcontainer-sid-text", sidError});
  }
  PWSTR profilePathRaw = nullptr;
  const HRESULT profilePathResult = GetAppContainerFolderPath(sidText, &profilePathRaw);
  LocalFree(sidText);
  if (FAILED(profilePathResult) || profilePathRaw == nullptr) {
    DeleteAppContainerProfile(profileName.c_str());
    FreeSid(sid);
    fs::remove_all(stage, filesystemError);
    return fail({"appcontainer-folder", win32CodeFromHresult(profilePathResult)});
  }
  const fs::path profilePath(profilePathRaw);
  CoTaskMemFree(profilePathRaw);
  const fs::path profileTempPath = profilePath / L"Temp";
  std::error_code profileFsError;
  const bool profileDirectoryExists = fs::is_directory(profilePath, profileFsError) &&
    !profileFsError;
  if (!profileDirectoryExists) {
    DeleteAppContainerProfile(profileName.c_str());
    FreeSid(sid);
    fs::remove_all(stage, filesystemError);
    return fail({"appcontainer-folder", ERROR_PATH_NOT_FOUND});
  }
  fs::create_directories(profileTempPath, profileFsError);
  const bool profileTempExists = fs::is_directory(profileTempPath, profileFsError) &&
    !profileFsError;
  if (!profileTempExists) {
    DeleteAppContainerProfile(profileName.c_str());
    FreeSid(sid);
    fs::remove_all(stage, filesystemError);
    return fail({"appcontainer-temp", ERROR_PATH_NOT_FOUND});
  }

  DiagnosticFailure failure{};
  PSECURITY_DESCRIPTOR oldDescriptor = nullptr;
  PACL oldDacl = nullptr;
  if (!grantAppContainerReadExecute(
      stage.wstring(), sid, &oldDescriptor, &oldDacl, &failure)) {
    if (oldDescriptor != nullptr) {
      DiagnosticFailure ignoredCleanup{};
      restoreDacl(stage.wstring(), oldDescriptor, oldDacl, &ignoredCleanup);
      LocalFree(oldDescriptor);
    }
    DeleteAppContainerProfile(profileName.c_str());
    FreeSid(sid);
    fs::remove_all(stage, filesystemError);
    return fail(failure);
  }

  HANDLE token = nullptr;
  if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY | TOKEN_DUPLICATE, &token)) {
    failure = {"token-open", GetLastError()};
  }

  Environment manual;
  Environment nativeSanitized;
  Environment minimalNative;
  if (failure.stage == nullptr &&
      !manualCurrentEnvironment(
        stagedWorkspace.wstring(), stagedExecutableDirectory.wstring(), &manual, &failure)) {
    if (failure.stage == nullptr) failure = {"manual-environment", ERROR_BAD_ENVIRONMENT};
  }
  if (failure.stage == nullptr &&
      !nativeSanitizedEnvironment(
        token, stagedWorkspace.wstring(), stagedExecutableDirectory.wstring(), true,
        &nativeSanitized, &failure)) {
    if (failure.stage == nullptr) failure = {"native-environment", ERROR_BAD_ENVIRONMENT};
  }
  if (failure.stage == nullptr &&
      !nativeSanitizedEnvironment(
        nullptr, stagedWorkspace.wstring(), stagedExecutableDirectory.wstring(), false,
        &minimalNative, &failure)) {
    if (failure.stage == nullptr) failure = {"minimal-native-environment", ERROR_BAD_ENVIRONMENT};
  }
  if (token != nullptr) CloseHandle(token);

  HANDLE job = nullptr;
  if (failure.stage == nullptr) {
    job = CreateJobObjectW(nullptr, nullptr);
    if (job == nullptr) failure = {"job-create", GetLastError()};
  }
  JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};
  limits.BasicLimitInformation.LimitFlags =
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_ACTIVE_PROCESS;
  limits.BasicLimitInformation.ActiveProcessLimit = 1;
  if (failure.stage == nullptr && !SetInformationJobObject(
      job, JobObjectExtendedLimitInformation, &limits, sizeof(limits))) {
    failure = {"job-limit", GetLastError()};
  }

  SECURITY_CAPABILITIES capabilities{};
  capabilities.AppContainerSid = sid;
  capabilities.CapabilityCount = 0;
  capabilities.Capabilities = nullptr;
  SIZE_T attributeSize = 0;
  LPPROC_THREAD_ATTRIBUTE_LIST attributes = nullptr;
  if (failure.stage == nullptr) {
    InitializeProcThreadAttributeList(nullptr, 1, 0, &attributeSize);
    const DWORD sizingError = GetLastError();
    if (sizingError != ERROR_INSUFFICIENT_BUFFER) {
      failure = {"attribute-list-size", sizingError};
    }
  }
  if (failure.stage == nullptr) {
    attributes = reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(
      HeapAlloc(GetProcessHeap(), HEAP_ZERO_MEMORY, attributeSize)
    );
    if (attributes == nullptr) failure = {"attribute-list-allocate", ERROR_NOT_ENOUGH_MEMORY};
  }
  if (failure.stage == nullptr && !InitializeProcThreadAttributeList(
      attributes, 1, 0, &attributeSize)) {
    failure = {"attribute-list-initialize", GetLastError()};
  }
  if (failure.stage == nullptr && !UpdateProcThreadAttribute(
      attributes, 0, PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES,
      &capabilities, sizeof(capabilities), nullptr, nullptr)) {
    failure = {"security-capabilities", GetLastError()};
  }

  PathMetadata executableMetadata{};
  PathMetadata workspaceMetadata{};
  PathMetadata executableDirectoryMetadata{};
  if (failure.stage == nullptr) {
    validateAppContainerPath(
      stagedExecutable.wstring(), false, "environment-diagnostic.exe", sid,
      &executableMetadata, &failure
    );
  }
  if (failure.stage == nullptr) {
    validateAppContainerPath(
      stagedWorkspace.wstring(), true, "workspace", sid,
      &workspaceMetadata, &failure
    );
  }
  if (failure.stage == nullptr) {
    validateAppContainerPath(
      stagedExecutableDirectory.wstring(), true, "node", sid,
      &executableDirectoryMetadata, &failure
    );
  }

  std::vector<wchar_t> originalCurrentDirectory;
  bool currentDirectoryConfined = false;
  if (failure.stage == nullptr) {
    const DWORD required = GetCurrentDirectoryW(0, nullptr);
    const DWORD currentDirectoryError = required == 0 ? GetLastError() : ERROR_SUCCESS;
    if (required == 0) {
      failure = {"current-directory-read", currentDirectoryError};
    } else {
      originalCurrentDirectory.resize(required);
      const DWORD copied = GetCurrentDirectoryW(required, originalCurrentDirectory.data());
      if (copied == 0 || copied >= required) {
        failure = {
          "current-directory-read",
          copied == 0 ? GetLastError() : ERROR_INSUFFICIENT_BUFFER
        };
      }
    }
  }
  if (failure.stage == nullptr) {
    currentDirectoryConfined = SetCurrentDirectoryW(stagedWorkspace.c_str()) != FALSE;
    if (!currentDirectoryConfined) {
      failure = {"current-directory-confine", GetLastError()};
    }
  }

  bool variantsComplete = false;
  bool argumentVariantsRan = false;
  VariantResult d{};
  VariantResult e{};
  VariantResult f{};
  VariantResult g{};
  VariantResult h{};
  VariantResult i{};
  VariantResult j{};
  VariantResult k{};
  Environment profileLocalAppData;
  Environment profileComplete;
  ProfileEnvironmentMetadata profileMetadata{
    false, false, false, profileDirectoryExists, profileTempExists
  };
  ProfileEnvironmentMetadata localAppDataMetadata{
    true, false, false, profileDirectoryExists, profileTempExists
  };
  ProfileEnvironmentMetadata completeMetadata{
    true, true, true, profileDirectoryExists, profileTempExists
  };
  if (failure.stage == nullptr) {
    const VariantResult a = runVariant(
      stagedExecutable.wstring(), stagedWorkspace.c_str(), manual, attributes, job
    );
    reportVariant("A", "manual", metadata(manual), a);
    d = runVariant(
      stagedExecutable.wstring(), stagedWorkspace.c_str(), nativeSanitized, attributes, job
    );
    const VariantResult c = runVariant(
      stagedExecutable.wstring(), stagedWorkspace.c_str(), minimalNative, attributes, job
    );
    reportVariant("C", "minimal-native", metadata(minimalNative), c);
    e = runVariant(
      stagedExecutable.wstring(), nullptr, nativeSanitized, attributes, job
    );
    f = runVariant(
      stagedExecutable.wstring(), stagedExecutableDirectory.c_str(), nativeSanitized,
      attributes, job
    );
    g = runVariant(
      stagedExecutable.wstring(), stagedWorkspace.c_str(), nativeSanitized, attributes, job,
      true
    );
    h = runVariant(
      stagedExecutable.wstring(), stagedWorkspace.c_str(), nativeSanitized, attributes, job,
      false
    );
    profileLocalAppData = profileEnvironment(nativeSanitized, profilePath.wstring(), false);
    profileComplete = profileEnvironment(nativeSanitized, profilePath.wstring(), true);
    i = runVariant(stagedExecutable.wstring(), stagedWorkspace.c_str(), nativeSanitized,
                   attributes, job);
    j = runVariant(stagedExecutable.wstring(), stagedWorkspace.c_str(), profileLocalAppData,
                   attributes, job);
    k = runVariant(stagedExecutable.wstring(), stagedWorkspace.c_str(), profileComplete,
                   attributes, job);
    argumentVariantsRan = true;
    variantsComplete =
      (!a.createProcess || (a.hasChildExit && a.childExit == kChildExit)) &&
      (!d.createProcess || (d.hasChildExit && d.childExit == kChildExit)) &&
      (!c.createProcess || (c.hasChildExit && c.childExit == kChildExit)) &&
      (!e.createProcess || (e.hasChildExit && e.childExit == kChildExit)) &&
      (!f.createProcess || (f.hasChildExit && f.childExit == kChildExit)) &&
      (!g.createProcess || (g.hasChildExit && g.childExit == kChildExit)) &&
      (!h.createProcess || (h.hasChildExit && h.childExit == kChildExit));
    variantsComplete = variantsComplete &&
      (!i.createProcess || (i.hasChildExit && i.childExit == kChildExit)) &&
      (!j.createProcess || (j.hasChildExit && j.childExit == kChildExit)) &&
      (!k.createProcess || (k.hasChildExit && k.childExit == kChildExit));
    if (!variantsComplete) failure = {"variant-containment", ERROR_PROCESS_ABORTED};
  }

  bool currentDirectoryRestored = !currentDirectoryConfined;
  if (currentDirectoryConfined) {
    currentDirectoryRestored =
      SetCurrentDirectoryW(originalCurrentDirectory.data()) != FALSE;
    if (!currentDirectoryRestored && failure.stage == nullptr) {
      failure = {"current-directory-restore", GetLastError()};
    }
  }

  if (attributes != nullptr) {
    DeleteProcThreadAttributeList(attributes);
    HeapFree(GetProcessHeap(), 0, attributes);
  }
  if (job != nullptr) CloseHandle(job);

  DiagnosticFailure cleanupFailure{};
  const bool daclRestored = restoreDacl(
    stage.wstring(), oldDescriptor, oldDacl, &cleanupFailure
  );
  if (oldDescriptor != nullptr) LocalFree(oldDescriptor);
  filesystemError.clear();
  fs::remove_all(stage, filesystemError);
  const bool stageRemoved = !filesystemError;
  const HRESULT profileCleanup = DeleteAppContainerProfile(profileName.c_str());
  FreeSid(sid);

  const bool cleanupPassed = currentDirectoryRestored && daclRestored && stageRemoved &&
    profileCleanup == S_OK;
  if (argumentVariantsRan) {
    reportArgumentVariant(
      "D", "explicit-workspace", executableMetadata, workspaceMetadata, d,
      cleanupPassed
    );
    reportArgumentVariant(
      "E", "null-confined-parent", executableMetadata, workspaceMetadata, e,
      cleanupPassed
    );
    reportArgumentVariant(
      "F", "explicit-executable-directory", executableMetadata,
      executableDirectoryMetadata, f, cleanupPassed
    );
    reportArgumentVariant(
      "G", "explicit-workspace", executableMetadata, workspaceMetadata, g,
      cleanupPassed, true
    );
    reportArgumentVariant(
      "H", "explicit-workspace", executableMetadata, workspaceMetadata, h,
      cleanupPassed, false
    );
    reportProfileVariant("I", nativeSanitized,
      profileMetadata, i, cleanupPassed);
    reportProfileVariant("J", profileLocalAppData, localAppDataMetadata, j, cleanupPassed);
    reportProfileVariant("K", profileComplete, completeMetadata, k, cleanupPassed);
  }

  if (failure.stage != nullptr) return fail(failure);
  if (!daclRestored) return fail(cleanupFailure);
  if (!stageRemoved) {
    return fail({"staging-cleanup", static_cast<DWORD>(filesystemError.value())});
  }
  if (profileCleanup != S_OK) {
    return fail({"profile-cleanup", win32CodeFromHresult(profileCleanup)});
  }
  return variantsComplete ? 0 : 2;
}
